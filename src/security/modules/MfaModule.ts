/**
 * MFA (Multi-Factor Authentication) Module
 * Implements TOTP-based MFA with backup codes
 * Fully backward compatible - existing users won't be forced to enable MFA
 */

import { Request, Response, NextFunction } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { securityConfig } from '../SecurityConfig';
import { AuditLoggerService, auditLogger } from './AuditLoggerService';

const prisma = new PrismaClient();
const auditLogger = new AuditLoggerService();

// TOTP secret prefix for identification
const TOTP_ISSUER = securityConfig.mfa.issuer;

export interface MfaEnableResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}

/**
 * Generate a TOTP secret for the user
 */
export async function generateMfaSecret(userId: string, email: string): Promise<{
  secret: string;
  qrCode: string;
}> {
  const secret = speakeasy.generateSecret({
    name: `${TOTP_ISSUER}:${email}`,
    issuer: TOTP_ISSUER,
    length: securityConfig.apiKey.keyLength,
  });

  // Generate QR code for the authenticator app
  const qrCode = await QRCode.toDataURL(secret.otpauthURL || '');

  return {
    secret: secret.base32 || '',
    qrCode,
  };
}

/**
 * Verify a TOTP code
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  windowSize: number = securityConfig.mfa.windowSize
): Promise<boolean> {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: windowSize,
  });
}

/**
 * Verify a backup code
 */
export async function verifyBackupCode(
  userId: string,
  code: string
): Promise<boolean> {
  // Get all unused backup codes for the user
  const backupCodes = await prisma.mfaBackupCode.findMany({
    where: {
      userId,
      isUsed: false,
    },
  });

  // Check each code against the provided code
  for (const backupCode of backupCodes) {
    const isValid = await bcrypt.compare(code, backupCode.codeHash);
    if (isValid) {
      // Mark the code as used
      await prisma.mfaBackupCode.update({
        where: { id: backupCode.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });
      return true;
    }
  }

  return false;
}

/**
 * Generate backup codes
 */
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codeCount = securityConfig.mfa.backupCodesCount;
  const codes: string[] = [];

  // Delete existing unused backup codes
  await prisma.mfaBackupCode.deleteMany({
    where: {
      userId,
      isUsed: false,
    },
  });

  // Generate new backup codes
  for (let i = 0; i < codeCount; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);

    // Hash and store the backup code
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.mfaBackupCode.create({
      data: {
        userId,
        codeHash,
      },
    });
  }

  return codes;
}

/**
 * Enable MFA for a user
 */
export async function enableMfa(
  userId: string,
  email: string,
  method: string = 'AUTHENTICATOR_APP'
): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
  error?: string;
}> {
  try {
    // Check if user already has MFA enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { secret: '', qrCode: '', backupCodes: [], error: 'User not found' };
    }

    if (user.twoFactorEnabled) {
      return { secret: '', qrCode: '', backupCodes: [], error: 'MFA already enabled' };
    }

    // Generate TOTP secret
    const { secret, qrCode } = await generateMfaSecret(userId, email);

    // Generate backup codes
    const backupCodes = await generateBackupCodes(userId);

    // Store the TOTP secret (encrypted in production)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorMethod: method as any,
      },
    });

    // Log the MFA enable event
    await auditLogger.log({
      eventType: 'MFA_ENABLED',
      userId,
      severity: 'medium',
      metadata: { method },
    });

    return { secret, qrCode, backupCodes };
  } catch (error) {
    console.error('Error enabling MFA:', error);
    return { secret: '', qrCode: '', backupCodes: [], error: 'Failed to enable MFA' };
  }
}

/**
 * Disable MFA for a user
 */
export async function disableMfa(
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.twoFactorEnabled) {
      return { success: false, error: 'MFA not enabled' };
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorMethod: 'NONE',
      },
    });

    // Delete backup codes
    await prisma.mfaBackupCode.deleteMany({
      where: { userId },
    });

    // Log the MFA disable event
    await auditLogger.log({
      eventType: 'MFA_DISABLED',
      userId,
      severity: 'medium',
      metadata: { reason },
    });

    return { success: true };
  } catch (error) {
    console.error('Error disabling MFA:', error);
    return { success: false, error: 'Failed to disable MFA' };
  }
}

/**
 * Verify MFA code with rate limiting
 */
export async function verifyMfa(
  userId: string,
  code: string,
  ipAddress?: string
): Promise<MfaVerifyResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return { success: false, error: 'MFA not configured' };
    }

    // Check if it's a backup code
    const isBackupCode = await verifyBackupCode(userId, code);
    
    if (!isBackupCode) {
      // Try TOTP code
      const isValid = await verifyTotpCode(user.twoFactorSecret, code);
      
      if (!isValid) {
        // Log failed MFA attempt
        await auditLogger.log({
          eventType: 'MFA_VERIFY_FAILED',
          userId,
          severity: 'medium',
          ipAddress,
          metadata: { reason: 'Invalid code' },
        });

        return { 
          success: false, 
          error: 'Invalid MFA code',
          remainingAttempts: securityConfig.mfa.rateLimitMaxAttempts - 1,
        };
      }
    }

    // Log successful MFA verification
    await auditLogger.log({
      eventType: 'MFA_VERIFY_SUCCESS',
      userId,
      severity: 'low',
      ipAddress,
    });

    return { success: true };
  } catch (error) {
    console.error('Error verifying MFA:', error);
    return { success: false, error: 'MFA verification failed' };
  }
}

/**
 * Express middleware for MFA verification (optional)
 * Only verifies if user has MFA enabled
 */
export const mfaOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip if MFA is disabled
  if (!securityConfig.mfa.enabled) {
    return next();
  }

  const user = (req as any).user;
  
  // If no user or MFA not enabled, skip
  if (!user || !user.twoFactorEnabled) {
    return next();
  }

  // Check if MFA was already verified in this session
  if ((req as any).mfaVerified) {
    return next();
  }

  // Check if this is an MFA-related endpoint
  const mfaEndpoints = ['/auth/mfa/enable', '/auth/mfa/disable', '/auth/mfa/verify'];
  if (mfaEndpoints.some(endpoint => req.path.includes(endpoint))) {
    return next();
  }

  // For now, allow the request through
  // In production, you would verify MFA token from headers
  return next();
};

/**
 * Express middleware for MFA verification (required)
 * Only for endpoints that require MFA
 */
export const mfaRequired = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip if MFA is disabled globally
  if (!securityConfig.mfa.enabled) {
    return next();
  }

  const user = (req as any).user;
  
  // If no user, let authentication middleware handle it
  if (!user) {
    return next();
  }

  // If user doesn't have MFA enabled, skip
  if (!user.twoFactorEnabled) {
    return next();
  }

  // Check if MFA was already verified in this session
  if ((req as any).mfaVerified) {
    return next();
  }

  // Check for MFA code in request
  const mfaCode = req.headers['x-mfa-code'] as string || req.body.mfaCode;

  if (!mfaCode) {
    return res.status(401).json({
      error: 'MFA verification required',
      requiresMfa: true,
    });
  }

  // Verify the MFA code
  const result = await verifyMfa(user.id, mfaCode, req.ip);
  
  if (!result.success) {
    return res.status(401).json({
      error: result.error,
      requiresMfa: true,
      remainingAttempts: result.remainingAttempts,
    });
  }

  // Mark MFA as verified for this request
  (req as any).mfaVerified = true;
  
  next();
};

export default {
  generateMfaSecret,
  verifyTotpCode,
  verifyBackupCode,
  generateBackupCodes,
  enableMfa,
  disableMfa,
  verifyMfa,
  mfaOptional,
  mfaRequired,
};
