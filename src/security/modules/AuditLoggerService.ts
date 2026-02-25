/**
 * Audit Logger Service
 * Comprehensive security audit logging
 * Structured logging for compliance and security monitoring
 */

import { PrismaClient } from '@prisma/client';
import { securityConfig } from '../SecurityConfig';

const prisma = new PrismaClient();

export type AuditEventType =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFY_SUCCESS'
  | 'MFA_VERIFY_FAILED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'API_KEY_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'REQUEST_SIGNATURE_INVALID'
  | 'WAF_BLOCKED';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  severity: AuditSeverity;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  message?: string;
}

class AuditLoggerService {
  private enabled: boolean;
  private logAuthAttempts: boolean;
  private logMfaEvents: boolean;
  private logApiKeyCreation: boolean;
  private logPermissionFailures: boolean;
  private logSuspiciousActivityFlag: boolean;
  private excludeSensitiveData: boolean;

  constructor() {
    this.enabled = securityConfig.auditLog.enabled;
    this.logAuthAttempts = securityConfig.auditLog.logAuthAttempts;
    this.logMfaEvents = securityConfig.auditLog.logMfaEvents;
    this.logApiKeyCreation = securityConfig.auditLog.logApiKeyCreation;
    this.logPermissionFailures = securityConfig.auditLog.logPermissionFailures;
    this.logSuspiciousActivityFlag = securityConfig.auditLog.logSuspiciousActivity;
    this.excludeSensitiveData = securityConfig.auditLog.excludeSensitiveData;
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Filter based on event type
    if (!this.shouldLog(entry.eventType)) {
      return;
    }

    // Exclude sensitive data if configured
    const metadata = this.excludeSensitiveData
      ? this.sanitizeMetadata(entry.metadata || {})
      : entry.metadata;

    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.eventType,
          resource: entry.resource,
          resourceId: entry.resourceId,
          metadata: {
            ...metadata,
            severity: entry.severity,
            message: entry.message,
          } as unknown as Record<string, unknown>,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Determine if an event should be logged based on configuration
   */
  private shouldLog(eventType: AuditEventType): boolean {
    if (eventType.startsWith('LOGIN') || eventType.startsWith('REGISTER')) {
      return this.logAuthAttempts;
    }
    if (eventType.startsWith('MFA_')) {
      return this.logMfaEvents;
    }
    if (eventType.startsWith('API_KEY_')) {
      return this.logApiKeyCreation;
    }
    if (eventType === 'PERMISSION_DENIED') {
      return this.logPermissionFailures;
    }
    if (eventType === 'SUSPICIOUS_ACTIVITY' || eventType === 'RATE_LIMIT_EXCEEDED') {
      return this.logSuspiciousActivityFlag;
    }
    return true;
  }

  /**
   * Sanitize metadata to remove sensitive data
   */
  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'apiKey',
      'secret',
      'secretKey',
      'accessToken',
      'authorization',
      'creditCard',
      'ssn',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log authentication attempt
   */
  async logAuthAttempt(
    userId: string | undefined,
    email: string | undefined,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: success ? 'LOGIN' : 'LOGIN_FAILED',
      userId,
      ipAddress,
      userAgent,
      severity: success ? 'low' : 'medium',
      metadata: { email: this.excludeSensitiveData ? '[REDACTED]' : email },
    });
  }

  /**
   * Log MFA event
   */
  async logMfaEvent(
    userId: string,
    eventType: 'MFA_ENABLED' | 'MFA_DISABLED' | 'MFA_VERIFY_SUCCESS' | 'MFA_VERIFY_FAILED',
    success: boolean,
    ipAddress?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      eventType,
      userId,
      ipAddress,
      severity: success ? 'low' : 'medium',
      metadata,
    });
  }

  /**
   * Log API key event
   */
  async logApiKeyEvent(
    userId: string,
    eventType: 'API_KEY_CREATED' | 'API_KEY_REVOKED' | 'API_KEY_EXPIRED',
    keyId: string,
    keyName: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      eventType,
      userId,
      resource: 'API_KEY',
      resourceId: keyId,
      ipAddress,
      severity: 'medium',
      metadata: { keyName },
    });
  }

  /**
   * Log permission failure
   */
  async logPermissionFailure(
    userId: string,
    resource: string,
    action: string,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      eventType: 'PERMISSION_DENIED',
      userId,
      resource,
      ipAddress,
      severity: 'medium',
      metadata: { action },
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    userId: string | undefined,
    activity: string,
    ipAddress?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      eventType: 'SUSPICIOUS_ACTIVITY',
      userId,
      ipAddress,
      severity: 'high',
      metadata: { activity, ...metadata },
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    options: {
      userId?: string;
      eventType?: AuditEventType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<unknown[]> {
    const where: Record<string, unknown> = {};

    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.eventType) {
      where.action = options.eventType;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        (where.createdAt as Record<string, Date>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.createdAt as Record<string, Date>).lte = options.endDate;
      }
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
      skip: options.offset || 0,
    });
  }
}

export const auditLogger = new AuditLoggerService();
export default AuditLoggerService;
