/**
 * Request Signing Middleware
 * HMAC SHA256 request signing with timestamp validation to prevent replay attacks
 * Optional - can be enabled per-endpoint or globally
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { securityConfig } from '../SecurityConfig';
import { auditLogger } from '../modules/AuditLoggerService';

// Extended Request interface
export interface SignedRequest extends Request {
  signatureValid?: boolean;
  signedAt?: Date;
}

/**
 * Generate HMAC signature for a request
 */
export function generateSignature(
  method: string,
  path: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  const signatureString = `${method}:${path}:${timestamp}:${body}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signatureString)
    .digest('hex');
}

/**
 * Verify request signature
 */
export function verifySignature(
  method: string,
  path: string,
  timestamp: string,
  body: string,
  signature: string,
  secret: string
): boolean {
  // Verify timestamp to prevent replay attacks
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Date.now();
  const tolerance = securityConfig.requestSigning.timestampToleranceMs;

  if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > tolerance) {
    console.warn('Request timestamp out of tolerance window');
    return false;
  }

  // Generate expected signature
  const expectedSignature = generateSignature(method, path, timestamp, body, secret);

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Extract signature from request
 */
function getSignatureFromRequest(req: Request): string | null {
  return (req.headers['x-signature'] as string) || null;
}

/**
 * Extract timestamp from request
 */
function getTimestampFromRequest(req: Request): string | null {
  return (req.headers['x-timestamp'] as string) || null;
}

/**
 * Middleware to validate request signature
 * Can be used as global or per-route middleware
 */
export const validateSignature = async (
  req: SignedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip if request signing is disabled
  if (!securityConfig.requestSigning.enabled) {
    return next();
  }

  // Skip for non-API routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Skip for health checks and public endpoints
  const publicPaths = ['/health', '/api-docs', '/api-keys/create'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const signature = getSignatureFromRequest(req);
  const timestamp = getTimestampFromRequest(req);
  const method = req.method;
  const path = req.path;
  const body = JSON.stringify(req.body) || '';

  // If signature is required but not provided
  if (securityConfig.requestSigning.requireSignature) {
    if (!signature || !timestamp) {
      res.status(401).json({
        error: 'Signature required',
        message: 'X-Signature and X-Timestamp headers are required',
      });
      return;
    }
  }

  // If no signature provided and not required, skip
  if (!signature || !timestamp) {
    return next();
  }

  // Get the secret - in production, this would be from the API key or user
  const secret = (req as any).apiKey?.keyHash || 
                 process.env.REQUEST_SIGNING_SECRET || 
                 'default-secret-change-in-production';

  // Verify signature
  const isValid = verifySignature(method, path, timestamp, body, signature, secret);

  if (!isValid) {
    // Log invalid signature attempt
    await auditLogger.log({
      eventType: 'REQUEST_SIGNATURE_INVALID',
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      severity: 'high',
      metadata: {
        method,
        path,
        timestamp,
      },
    });

    res.status(401).json({
      error: 'Invalid signature',
      message: 'Request signature verification failed',
    });
    return;
  }

  // Mark request as signature validated
  req.signatureValid = true;
  req.signedAt = new Date(parseInt(timestamp, 10));

  next();
};

/**
 * Helper to add signature headers to outgoing requests (for service-to-service)
 */
export function signRequest(
  method: string,
  path: string,
  body: string,
  secret: string
): { 'x-signature': string; 'x-timestamp': string } {
  const timestamp = Date.now().toString();
  const signature = generateSignature(method, path, timestamp, body, secret);

  return {
    'x-signature': signature,
    'x-timestamp': timestamp,
  };
}

export default {
  generateSignature,
  verifySignature,
  validateSignature,
  signRequest,
};
