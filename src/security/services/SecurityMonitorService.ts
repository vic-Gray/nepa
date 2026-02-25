/**
 * Security Monitoring Service
 * Real-time security monitoring with suspicious activity detection
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { securityConfig } from '../SecurityConfig';
import { auditLogger } from '../modules/AuditLoggerService';

const prisma = new PrismaClient();

// Redis client for real-time tracking
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export interface SecurityAlert {
  id: string;
  type: 'FAILED_LOGIN' | 'TOKEN_ABUSE' | 'API_KEY_ABUSE' | 'SUSPICIOUS_IP' | 'RATE_LIMIT';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

class SecurityMonitorService {
  private enabled: boolean;
  private failedLoginThreshold: number;
  private failedLoginWindowMs: number;
  private tokenAbuseThreshold: number;
  private ipAnomalyDetection: boolean;

  constructor() {
    this.enabled = securityConfig.monitoring.enabled;
    this.failedLoginThreshold = securityConfig.monitoring.failedLoginThreshold;
    this.failedLoginWindowMs = securityConfig.monitoring.failedLoginWindowMs;
    this.tokenAbuseThreshold = securityConfig.monitoring.tokenAbuseThreshold;
    this.ipAnomalyDetection = securityConfig.monitoring.ipAnomalyDetection;
  }

  /**
   * Track failed login attempt
   */
  async trackFailedLogin(userId: string, ipAddress: string): Promise<number> {
    const key = `failed_login:${userId}`;
    const now = Date.now();

    // Increment counter
    const attempts = await redis.incr(key);

    // Set expiry if first attempt
    if (attempts === 1) {
      await redis.expire(key, Math.ceil(this.failedLoginWindowMs / 1000));
    }

    // Check if threshold exceeded
    if (attempts >= this.failedLoginThreshold) {
      await this.triggerAlert({
        type: 'FAILED_LOGIN',
        severity: 'high',
        userId,
        ipAddress,
        message: `Multiple failed login attempts detected for user ${userId}`,
        metadata: { attempts, threshold: this.failedLoginThreshold },
      });
    }

    return attempts;
  }

  /**
   * Reset failed login counter
   */
  async resetFailedLogin(userId: string): Promise<void> {
    const key = `failed_login:${userId}`;
    await redis.del(key);
  }

  /**
   * Track token usage for abuse detection
   */
  async trackTokenUsage(userId: string, ipAddress: string): Promise<boolean> {
    const key = `token_usage:${userId}:${new Date().toISOString().split('T')[0]}`;
    
    const usageCount = await redis.incr(key);
    
    if (usageCount === 1) {
      await redis.expire(key, 86400); // 24 hours
    }

    if (usageCount > this.tokenAbuseThreshold) {
      await this.triggerAlert({
        type: 'TOKEN_ABUSE',
        severity: 'high',
        userId,
        ipAddress,
        message: `Token abuse detected: ${usageCount} requests in 24 hours`,
        metadata: { usageCount, threshold: this.tokenAbuseThreshold },
      });
      return false;
    }

    return true;
  }

  /**
   * Track API key usage
   */
  async trackApiKeyUsage(
    apiKeyId: string,
    userId: string,
    ipAddress: string
  ): Promise<boolean> {
    const key = `api_key_usage:${apiKeyId}:${new Date().toISOString().split('T')[0]}`;
    
    const usageCount = await redis.incr(key);
    
    if (usageCount === 1) {
      await redis.expire(key, 86400); // 24 hours
    }

    const threshold = 10000; // API key daily limit

    if (usageCount > threshold) {
      await this.triggerAlert({
        type: 'API_KEY_ABUSE',
        severity: 'critical',
        userId,
        ipAddress,
        message: `API key abuse detected: ${usageCount} requests in 24 hours`,
        metadata: { usageCount, threshold },
      });
      return false;
    }

    return true;
  }

  /**
   * Check if IP is blocked
   */
  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const blocked = await redis.get(`blocked_ip:${ipAddress}`);
    return blocked !== null;
  }

  /**
   * Block IP temporarily
   */
  async blockIp(ipAddress: string, durationSeconds: number = 3600): Promise<void> {
    await redis.setex(`blocked_ip:${ipAddress}`, durationSeconds, 'blocked');
    
    await auditLogger.log({
      eventType: 'SUSPICIOUS_ACTIVITY',
      severity: 'high',
      ipAddress,
      metadata: { action: 'IP_BLOCKED', duration: durationSeconds },
    });
  }

  /**
   * Detect suspicious IP patterns
   */
  async analyzeIp(ipAddress: string, userId?: string): Promise<boolean> {
    if (!this.ipAnomalyDetection) {
      return false;
    }

    // Check for multiple users from same IP
    const recentActivity = await redis.keys(`failed_login:*`);
    
    // Simple heuristic: flag if too many distinct users from same IP
    const userCount = await redis.scard(`ip_users:${ipAddress}`);
    
    if (userCount > 10) {
      await this.triggerAlert({
        type: 'SUSPICIOUS_IP',
        severity: 'medium',
        ipAddress,
        message: `Multiple user accounts accessed from IP ${ipAddress}`,
        metadata: { userCount },
      });
    }

    // Add user to IP set
    if (userId) {
      await redis.sadd(`ip_users:${ipAddress}`, userId);
      await redis.expire(`ip_users:${ipAddress}`, 86400);
    }

    return false;
  }

  /**
   * Trigger security alert
   */
  async triggerAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp'>): Promise<void> {
    console.error('🔒 Security Alert:', alert);

    if (securityConfig.monitoring.alertOnSuspiciousActivity) {
      // In production, this would send notifications:
      // - Email to security team
      // - Slack/Discord webhook
      // - PagerDuty for critical alerts
      // - SMS for critical alerts
      
      // For now, log to console and audit log
      await auditLogger.log({
        eventType: 'SUSPICIOUS_ACTIVITY',
        userId: alert.userId,
        ipAddress: alert.ipAddress,
        severity: alert.severity,
        metadata: {
          alertType: alert.type,
          message: alert.message,
          ...alert.metadata,
        },
      });
    }

    // Auto-block for critical severity
    if (alert.severity === 'critical' && alert.ipAddress) {
      await this.blockIp(alert.ipAddress, 3600); // 1 hour
    }
  }

  /**
   * Get security stats
   */
  async getSecurityStats(): Promise<{
    blockedIps: number;
    failedLogins: number;
    alerts: number;
  }> {
    const blockedIps = await redis.keys('blocked_ip:*').then(keys => keys.length);
    const failedLogins = await redis.keys('failed_login:*').then(keys => keys.length);
    
    const alerts = await prisma.auditLog.count({
      where: {
        action: 'SUSPICIOUS_ACTIVITY',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return { blockedIps, failedLogins, alerts };
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<void> {
    // Redis keys automatically expire
    // This method can be used for additional cleanup if needed
  }
}

export const securityMonitor = new SecurityMonitorService();
export default SecurityMonitorService;
