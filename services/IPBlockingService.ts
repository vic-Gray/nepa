import Redis from 'ioredis';
import { Request } from 'express';

export interface AbusePattern {
  type: 'RATE_LIMIT_BREACH' | 'FAILED_AUTH' | 'MALICIOUS_PAYLOAD' | 'DDOS_PATTERN' | 'MANUAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  threshold: number;
  windowMs: number;
}

export interface IPBlockRecord {
  ip: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blockedAt: Date;
  expiresAt: Date;
  evidence: Record<string, any>;
  autoBlock: boolean;
}

/**
 * IP Blocking and Abuse Detection Service
 * Automatically detects and blocks abusive IPs based on behavior patterns
 */
export class IPBlockingService {
  private redis: Redis;
  private readonly IP_BLOCK_PREFIX = 'ip_block';
  private readonly IP_ABUSE_PREFIX = 'ip_abuse';
  private readonly ABUSE_PATTERNS: Record<string, AbusePattern> = {
    RATE_LIMIT_BREACH: {
      type: 'RATE_LIMIT_BREACH',
      severity: 'MEDIUM',
      threshold: 10, // 10 breaches
      windowMs: 60 * 60 * 1000 // 1 hour
    },
    FAILED_AUTH: {
      type: 'FAILED_AUTH',
      severity: 'MEDIUM',
      threshold: 20, // 20 failed attempts
      windowMs: 15 * 60 * 1000 // 15 minutes
    },
    MALICIOUS_PAYLOAD: {
      type: 'MALICIOUS_PAYLOAD',
      severity: 'HIGH',
      threshold: 3, // 3 malicious payloads
      windowMs: 60 * 60 * 1000 // 1 hour
    },
    DDOS_PATTERN: {
      type: 'DDOS_PATTERN',
      severity: 'CRITICAL',
      threshold: 100, // 100 requests
      windowMs: 10 * 1000 // 10 seconds
    }
  };

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Check if an IP is blocked
   */
  async isIPBlocked(ip: string): Promise<IPBlockRecord | null> {
    const blockKey = `${this.IP_BLOCK_PREFIX}:${ip}`;
    const blockData = await this.redis.get(blockKey);

    if (!blockData) {
      return null;
    }

    const record: IPBlockRecord = JSON.parse(blockData);

    // Check if block has expired
    if (new Date(record.expiresAt) < new Date()) {
      await this.redis.del(blockKey);
      return null;
    }

    return record;
  }

  /**
   * Record abuse activity for an IP
   */
  async recordAbuse(ip: string, patternType: string, details: Record<string, any> = {}): Promise<void> {
    const pattern = this.ABUSE_PATTERNS[patternType];

    if (!pattern) {
      console.warn(`Unknown abuse pattern: ${patternType}`);
      return;
    }

    const abuseKey = `${this.IP_ABUSE_PREFIX}:${ip}:${patternType}`;
    const now = Date.now();

    // Get current abuse count in this window
    const windowStart = Math.floor(now / pattern.windowMs) * pattern.windowMs;
    const windowed_Key = `${abuseKey}:${windowStart}`;

    await this.redis.incr(windowed_Key);
    await this.redis.expire(windowed_Key, Math.ceil(pattern.windowMs / 1000));

    // Get total count in current window
    const countStr = await this.redis.get(windowed_Key);
    const count = parseInt(countStr || '0');

    // Check if threshold is exceeded
    if (count >= pattern.threshold) {
      // Auto-block the IP
      let blockDuration = 60 * 60 * 1000; // 1 hour default

      // Increase duration based on severity
      switch (pattern.severity) {
        case 'HIGH':
          blockDuration = 24 * 60 * 60 * 1000; // 24 hours
          break;
        case 'CRITICAL':
          blockDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
          break;
      }

      await this.blockIP(ip, `Auto-blocked: ${patternType}`, pattern.severity, true, {
        pattern: patternType,
        count,
        threshold: pattern.threshold,
        ...details
      });
    }
  }

  /**
   * Manually block an IP
   */
  async blockIP(
    ip: string,
    reason: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
    autoBlock: boolean = false,
    evidence: Record<string, any> = {}
  ): Promise<IPBlockRecord> {
    // Check if already blocked
    const existing = await this.isIPBlocked(ip);
    if (existing) {
      return existing;
    }

    // Determine block duration based on severity
    let blockDurationMs = 60 * 60 * 1000; // 1 hour default

    switch (severity) {
      case 'LOW':
        blockDurationMs = 15 * 60 * 1000; // 15 minutes
        break;
      case 'MEDIUM':
        blockDurationMs = 60 * 60 * 1000; // 1 hour
        break;
      case 'HIGH':
        blockDurationMs = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'CRITICAL':
        blockDurationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + blockDurationMs);

    const record: IPBlockRecord = {
      ip,
      reason,
      severity,
      blockedAt: now,
      expiresAt,
      evidence,
      autoBlock
    };

    const blockKey = `${this.IP_BLOCK_PREFIX}:${ip}`;
    await this.redis.setex(blockKey, Math.ceil(blockDurationMs / 1000), JSON.stringify(record));

    // Log block event
    await this.logBlockEvent(record);

    return record;
  }

  /**
   * Unblock an IP (manual operation)
   */
  async unblockIP(ip: string): Promise<boolean> {
    const blockKey = `${this.IP_BLOCK_PREFIX}:${ip}`;
    const result = await this.redis.del(blockKey);
    return result > 0;
  }

  /**
   * Get blocked IPs (paginated)
   */
  async getBlockedIPs(limit: number = 100, offset: number = 0): Promise<IPBlockRecord[]> {
    const keys = await this.redis.keys(`${this.IP_BLOCK_PREFIX}:*`);
    const blocks: IPBlockRecord[] = [];

    // Remove expired blocks and collect valid ones
    for (const key of keys) {
      const blockData = await this.redis.get(key);
      if (blockData) {
        const record: IPBlockRecord = JSON.parse(blockData);

        if (new Date(record.expiresAt) < new Date()) {
          await this.redis.del(key);
        } else {
          blocks.push(record);
        }
      }
    }

    // Sort by blocked time (most recent first) and apply pagination
    return blocks.sort((a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime()).slice(offset, offset + limit);
  }

  /**
   * Get abuse statistics for an IP
   */
  async getAbuseStats(ip: string): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};

    for (const patternType of Object.keys(this.ABUSE_PATTERNS)) {
      const pattern = this.ABUSE_PATTERNS[patternType];
      const now = Date.now();
      const windowStart = Math.floor(now / pattern.windowMs) * pattern.windowMs;
      const windowed_Key = `${this.IP_ABUSE_PREFIX}:${ip}:${patternType}:${windowStart}`;

      const countStr = await this.redis.get(windowed_Key);
      stats[patternType] = parseInt(countStr || '0');
    }

    return stats;
  }

  /**
   * Reset abuse statistics for an IP
   */
  async resetAbuseStats(ip: string): Promise<void> {
    const keys = await this.redis.keys(`${this.IP_ABUSE_PREFIX}:${ip}:*`);

    for (const key of keys) {
      await this.redis.del(key);
    }
  }

  /**
   * Analyze request pattern for DDOS
   */
  async analyzeDDOSPattern(ip: string, endpoint: string, method: string): Promise<boolean> {
    const pattern = this.ABUSE_PATTERNS['DDOS_PATTERN'];
    const key = `${this.IP_ABUSE_PREFIX}:${ip}:ddos:${endpoint}:${method}`;
    const now = Date.now();

    // Use sliding window for DDOS detection
    const windowStart = Math.floor(now / pattern.windowMs) * pattern.windowMs;
    const windowed_Key = `${key}:${windowStart}`;

    const count = await this.redis.incr(windowed_Key);
    await this.redis.expire(windowed_Key, Math.ceil(pattern.windowMs / 1000) + 1);

    return count > pattern.threshold;
  }

  /**
   * Get IP whitelist
   */
  async getWhitelistIPs(): Promise<string[]> {
    const whitelistData = await this.redis.get('ip_whitelist');
    return whitelistData ? JSON.parse(whitelistData) : [];
  }

  /**
   * Add IP to whitelist
   */
  async whitelistIP(ip: string): Promise<void> {
    const whitelist = await this.getWhitelistIPs();

    if (!whitelist.includes(ip)) {
      whitelist.push(ip);
      await this.redis.set('ip_whitelist', JSON.stringify(whitelist));
    }
  }

  /**
   * Remove IP from whitelist
   */
  async removeFromWhitelist(ip: string): Promise<void> {
    const whitelist = await this.getWhitelistIPs();
    const filtered = whitelist.filter(w => w !== ip);
    await this.redis.set('ip_whitelist', JSON.stringify(filtered));
  }

  /**
   * Check if IP is whitelisted
   */
  async isIPWhitelisted(ip: string): Promise<boolean> {
    const whitelist = await this.getWhitelistIPs();
    return whitelist.includes(ip) || whitelist.includes('*');
  }

  /**
   * Log block event for audit trail
   */
  private async logBlockEvent(record: IPBlockRecord): Promise<void> {
    const auditKey = `ip_block_audit:${new Date().toISOString().split('T')[0]}`;
    const auditLog = await this.redis.get(auditKey);
    let events = auditLog ? JSON.parse(auditLog) : [];

    events.push(record);

    // Keep last 1000 events
    if (events.length > 1000) {
      events = events.slice(-1000);
    }

    // Set 30 day TTL
    await this.redis.setex(auditKey, 30 * 24 * 60 * 60, JSON.stringify(events));
  }

  /**
   * Get audit log for a date
   */
  async getAuditLog(date: Date): Promise<IPBlockRecord[]> {
    const auditKey = `ip_block_audit:${date.toISOString().split('T')[0]}`;
    const auditLog = await this.redis.get(auditKey);
    return auditLog ? JSON.parse(auditLog) : [];
  }
}
