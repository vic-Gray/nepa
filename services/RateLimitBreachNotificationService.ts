import { RateLimitBreach } from '../types/rateLimit';
import Redis from 'ioredis';
import axios from 'axios';
import nodemailer from 'nodemailer';

interface NotificationChannel {
  type: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'sms';
  config: Record<string, string>;
  enabled: boolean;
  minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface NotificationPreference {
  userId?: string;
  channels: NotificationChannel[];
  breachThreshold: number; // Minimum num of breaches before alert
  quietHours?: {
    start: number; // hour
    end: number;
  };
  enabled: boolean;
}

/**
 * Rate Limit Breach Notification Service
 * Handles notifications for rate limit breaches across multiple channels
 */
export class RateLimitBreachNotificationService {
  private redis: Redis;
  private emailTransport: nodemailer.Transporter;
  private readonly NOTIFICATION_PREF_PREFIX = 'notification_pref';
  private readonly BREACH_CACHE_PREFIX = 'breach_cache';
  private notificationHandlers: Map<string, (breach: RateLimitBreach, config: Record<string, string>) => Promise<void>>;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

    // Initialize email transport
    this.emailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Register notification handlers
    this.notificationHandlers = new Map([
      ['email', this.sendEmailNotification.bind(this)],
      ['slack', this.sendSlackNotification.bind(this)],
      ['pagerduty', this.sendPagerDutyNotification.bind(this)],
      ['webhook', this.sendWebhookNotification.bind(this)],
      ['sms', this.sendSMSNotification.bind(this)]
    ]);
  }

  /**
   * Send breach notification to all configured channels
   */
  async notifyBreach(breach: RateLimitBreach): Promise<void> {
    // Get global notification settings
    const globalPrefs = await this.getNotificationPreferences();

    // Send to global admin channels
    if (!this.isInQuietHours(globalPrefs)) {
      await this.sendToChannels(breach, globalPrefs.channels);
    }

    // Check user-specific preferences if userId exists
    if (breach.userId) {
      const userPrefs = await this.getUserNotificationPreferences(breach.userId);
      if (userPrefs && userPrefs.enabled && !this.isInQuietHours(userPrefs)) {
        await this.sendToChannels(breach, userPrefs.channels);
      }
    }

    // Cache breach for analytics
    await this.cacheBreach(breach);
  }

  /**
   * Send notifications through specified channels
   */
  private async sendToChannels(breach: RateLimitBreach, channels: NotificationChannel[]): Promise<void> {
    const tasks = channels
      .filter(channel => channel.enabled && this.shouldNotify(channel, breach.severity))
      .map(channel => {
        const handler = this.notificationHandlers.get(channel.type);
        if (handler) {
          return handler(breach, channel.config).catch(error => {
            console.error(`Failed to send ${channel.type} notification:`, error);
          });
        }
      });

    await Promise.all(tasks);
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(breach: RateLimitBreach, config: Record<string, string>): Promise<void> {
    const to = config.recipients || 'admin@example.com';

    const htmlContent = this.generateEmailHTML(breach);

    await this.emailTransport.sendMail({
      from: config.from || process.env.SMTP_FROM || 'no-reply@api.example.com',
      to,
      subject: `🚨 Rate Limit Breach Alert - ${breach.severity} Severity`,
      html: htmlContent,
      text: this.generateEmailText(breach)
    });

    console.log(`Email notification sent for breach ${breach.id}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(breach: RateLimitBreach, config: Record<string, string>): Promise<void> {
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color =
      breach.severity === 'CRITICAL' ? 'danger' : breach.severity === 'HIGH' ? 'warning' : 'good';

    const payload = {
      attachments: [
        {
          color,
          title: `Rate Limit Breach - ${breach.severity} Severity`,
          fields: [
            {
              title: 'IP Address',
              value: breach.ip,
              short: true
            },
            {
              title: 'Endpoint',
              value: breach.endpoint,
              short: true
            },
            {
              title: 'Breach Type',
              value: breach.breachType,
              short: true
            },
            {
              title: 'Timestamp',
              value: new Date(breach.timestamp).toISOString(),
              short: true
            },
            {
              title: 'Details',
              value: JSON.stringify(breach.details, null, 2),
              short: false
            }
          ],
          footer: 'API Rate Limit Monitor'
        }
      ]
    };

    if (config.channel) {
      (payload as any).channel = config.channel;
    }

    await axios.post(webhookUrl, payload);
    console.log(`Slack notification sent for breach ${breach.id}`);
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(breach: RateLimitBreach, config: Record<string, string>): Promise<void> {
    const integrationKey = config.integrationKey;
    if (!integrationKey) {
      throw new Error('PagerDuty integration key not configured');
    }

    const severity =
      breach.severity === 'CRITICAL' ? 'critical' : breach.severity === 'HIGH' ? 'error' : 'warning';

    const payload = {
      routing_key: integrationKey,
      event_action: 'trigger',
      dedup_key: breach.id,
      payload: {
        summary: `Rate Limit Breach at ${breach.endpoint} from ${breach.ip}`,
        severity,
        source: 'API Rate Limit Monitor',
        custom_details: {
          breach_type: breach.breachType,
          endpoint: breach.endpoint,
          ip: breach.ip,
          timestamp: breach.timestamp,
          details: breach.details
        }
      }
    };

    await axios.post('https://events.pagerduty.com/v2/enqueue', payload);
    console.log(`PagerDuty notification sent for breach ${breach.id}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(breach: RateLimitBreach, config: Record<string, string>): Promise<void> {
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      event: 'rate_limit_breach',
      breach: breach,
      timestamp: new Date().toISOString()
    };

    const headers = config.headers ? JSON.parse(config.headers) : {};

    await axios.post(webhookUrl, payload, { headers });
    console.log(`Webhook notification sent for breach ${breach.id}`);
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(breach: RateLimitBreach, config: Record<string, string>): Promise<void> {
    // This would integrate with services like Twilio, AWS SNS, etc.
    // Placeholder implementation
    console.log(`SMS notification would be sent to: ${config.phoneNumber}`);
    console.log(`Message: Rate limit breach detected at ${breach.endpoint} from ${breach.ip}`);
  }

  /**
   * Set notification preferences
   */
  async setNotificationPreferences(prefs: NotificationPreference, userId?: string): Promise<void> {
    const key = userId ? `${this.NOTIFICATION_PREF_PREFIX}:user:${userId}` : `${this.NOTIFICATION_PREF_PREFIX}:global`;

    await this.redis.set(key, JSON.stringify(prefs));
  }

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreference> {
    const data = await this.redis.get(`${this.NOTIFICATION_PREF_PREFIX}:global`);

    if (data) {
      return JSON.parse(data);
    }

    // Default global preferences
    return {
      channels: [
        {
          type: 'email',
          config: {
            recipients: process.env.ADMIN_EMAIL || 'admin@example.com'
          },
          enabled: true,
          minSeverity: 'HIGH'
        },
        {
          type: 'slack',
          config: {
            webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
            channel: '#alerts'
          },
          enabled: !!process.env.SLACK_WEBHOOK_URL,
          minSeverity: 'MEDIUM'
        }
      ],
      breachThreshold: 1,
      enabled: true
    };
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreference | null> {
    const data = await this.redis.get(`${this.NOTIFICATION_PREF_PREFIX}:user:${userId}`);

    return data ? JSON.parse(data) : null;
  }

  /**
   * Update notification channel
   */
  async updateNotificationChannel(
    channelType: string,
    config: Record<string, string>,
    userId?: string
  ): Promise<void> {
    const prefs = userId
      ? await this.getUserNotificationPreferences(userId)
      : await this.getNotificationPreferences();

    if (!prefs) {
      throw new Error('Preferences not found');
    }

    const channelIndex = prefs.channels.findIndex(ch => ch.type === channelType);

    if (channelIndex >= 0) {
      prefs.channels[channelIndex].config = config;
    } else {
      prefs.channels.push({
        type: channelType as any,
        config,
        enabled: true,
        minSeverity: 'HIGH'
      });
    }

    await this.setNotificationPreferences(prefs, userId);
  }

  /**
   * Get breach notifications history
   */
  async getBreachHistory(limit: number = 100, offset: number = 0): Promise<RateLimitBreach[]> {
    const keys = await this.redis.keys(`${this.BREACH_CACHE_PREFIX}:*`);
    const breaches: RateLimitBreach[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        breaches.push(JSON.parse(data));
      }
    }

    return breaches
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Cache breach for retrieval
   */
  private async cacheBreach(breach: RateLimitBreach): Promise<void> {
    const key = `${this.BREACH_CACHE_PREFIX}:${breach.id}`;
    // Keep breach info for 30 days
    await this.redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(breach));
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(prefs: NotificationPreference): boolean {
    if (!prefs.quietHours) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();

    const { start, end } = prefs.quietHours;

    if (start < end) {
      return currentHour >= start && currentHour < end;
    } else {
      // spans midnight
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Check if notification should be sent based on severity
   */
  private shouldNotify(channel: NotificationChannel, severity: string): boolean {
    const severityOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const minOrder = severityOrder[channel.minSeverity] || 0;
    const actualOrder = severityOrder[severity as keyof typeof severityOrder] || 0;

    return actualOrder >= minOrder;
  }

  /**
   * Generate email HTML content
   */
  private generateEmailHTML(breach: RateLimitBreach): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #d9534f;">🚨 Rate Limit Breach Alert</h2>
          <p><strong>Severity:</strong> <span style="color: #d9534f; font-weight: bold;">${breach.severity}</span></p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>IP Address:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${breach.ip}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Endpoint:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${breach.endpoint}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Breach Type:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${breach.breachType}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Timestamp:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${new Date(breach.timestamp).toISOString()}</td>
            </tr>
          </table>
          <h3>Details</h3>
          <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(breach.details, null, 2)}</pre>
          <hr />
          <p style="color: #999; font-size: 12px;">This is an automated alert from your API Rate Limit Monitor</p>
        </body>
      </html>
    `;
  }

  /**
   * Generate email text content
   */
  private generateEmailText(breach: RateLimitBreach): string {
    return `
Rate Limit Breach Alert - ${breach.severity} Severity

IP Address: ${breach.ip}
Endpoint: ${breach.endpoint}
Breach Type: ${breach.breachType}
Timestamp: ${new Date(breach.timestamp).toISOString()}

Details:
${JSON.stringify(breach.details, null, 2)}

---
This is an automated alert from your API Rate Limit Monitor
    `.trim();
  }
}
