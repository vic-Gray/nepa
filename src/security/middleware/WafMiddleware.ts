/**
 * WAF (Web Application Firewall) Integration Middleware
 * Compatible with Cloudflare, AWS WAF, and custom WAF solutions
 */

import { Request, Response, NextFunction } from 'express';
import { securityConfig } from '../SecurityConfig';
import { auditLogger } from '../modules/AuditLoggerService';

// WAF provider types
export type WafProvider = 'cloudflare' | 'aws-waf' | 'custom';

// WAF event types
export interface WafEvent {
  provider: WafProvider;
  action: string;
  clientIp: string;
  userAgent?: string;
  uri: string;
  method: string;
  timestamp: Date;
  ruleId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Extract client IP considering proxy headers
 */
function getClientIp(req: Request): string {
  // Check various proxy headers in order
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return (forwardedFor as string).split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp as string;
  }

  // Fall back to connection remote address
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Detect if request was blocked by WAF
 */
function isWafBlocked(req: Request): boolean {
  // Cloudflare blocked
  if (req.headers['cf-ray'] && req.headers['cf-cf-ray']) {
    return true;
  }

  // AWS WAF blocked
  if (req.headers['x-aws-waf-action'] === 'block') {
    return true;
  }

  // Custom WAF header
  if (req.headers['x-waf-blocked'] === 'true') {
    return true;
  }

  return false;
}

/**
 * Get WAF rule ID from request
 */
function getWafRuleId(req: Request): string | undefined {
  // Cloudflare
  if (req.headers['cf-ray']) {
    return req.headers['cf-ray'] as string;
  }

  // AWS WAF
  if (req.headers['x-aws-waf-rule-id']) {
    return req.headers['x-aws-waf-rule-id'] as string;
  }

  // Custom
  return req.headers['x-waf-rule-id'] as string | undefined;
}

/**
 * Log WAF event
 */
async function logWafEvent(event: WafEvent): Promise<void> {
  if (!securityConfig.waf.logWafEvents) {
    return;
  }

  await auditLogger.log({
    eventType: 'WAF_BLOCKED',
    ipAddress: event.clientIp,
    severity: 'high',
    metadata: {
      provider: event.provider,
      action: event.action,
      ruleId: event.ruleId,
      uri: event.uri,
      method: event.method,
    },
  });
}

/**
 * Middleware to detect and handle WAF-blocked requests
 */
export const wafDetector = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip if WAF integration is disabled
  if (!securityConfig.waf.enabled || !securityConfig.waf.detectBlockedRequests) {
    return next();
  }

  // Check if request was blocked by WAF
  if (isWafBlocked(req)) {
    const clientIp = getClientIp(req);
    const ruleId = getWafRuleId(req);

    console.warn(`🚨 WAF blocked request:`, {
      ip: clientIp,
      path: req.path,
      method: req.method,
      ruleId,
    });

    // Log the WAF event
    await logWafEvent({
      provider: securityConfig.waf.provider,
      action: 'BLOCK',
      clientIp,
      userAgent: req.headers['user-agent'],
      uri: req.path,
      method: req.method,
      timestamp: new Date(),
      ruleId,
    });

    return res.status(403).json({
      error: 'Access denied',
      message: 'Your request was blocked by security policy',
    });
  }

  next();
};

/**
 * Middleware to add WAF headers to responses
 */
export const wafHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add WAF provider headers if enabled
  if (securityConfig.waf.enabled) {
    // Cloudflare-specific
    res.setHeader('X-Security-Policy', 'protected');
    
    // Note: In production, you would add specific headers from your WAF provider
    // e.g., CF-Cache-Status, X-SSL-Protocol, etc.
  }

  next();
};

/**
 * Trust proxy configuration
 * Essential for getting correct client IPs behind load balancers/WAF
 */
export const trustProxy = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (securityConfig.compliance.trustProxy) {
    // Express's trust proxy setting should be configured at app level
    // This middleware documents that it needs to be enabled
  }
  next();
};

/**
 * Middleware to forward WAF headers to backend
 */
export const forwardWafHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!securityConfig.waf.enabled) {
    return next();
  }

  // Extract and store WAF headers for logging/monitoring
  const wafHeaders: Record<string, string> = {};
  
  // Cloudflare headers
  if (req.headers['cf-ray']) {
    wafHeaders['cf-ray'] = req.headers['cf-ray'] as string;
  }
  if (req.headers['cf-country']) {
    wafHeaders['cf-country'] = req.headers['cf-country'] as string;
  }
  if (req.headers['cf-city']) {
    wafHeaders['cf-city'] = req.headers['cf-city'] as string;
  }
  
  // AWS WAF headers
  if (req.headers['x-aws-waf-rule-id']) {
    wafHeaders['aws-waf-rule-id'] = req.headers['x-aws-waf-rule-id'] as string;
  }
  if (req.headers['x-aws-waf-action']) {
    wafHeaders['aws-waf-action'] = req.headers['x-aws-waf-action'] as string;
  }

  // Store for later use
  (req as any).wafHeaders = wafHeaders;
  
  next();
};

export default {
  wafDetector,
  wafHeaders,
  trustProxy,
  forwardWafHeaders,
};
