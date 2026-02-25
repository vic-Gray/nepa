/**
 * API Key Management Module
 * Advanced API key system with scoping, expiration, and rotation
 * Hashes keys before storage - never stores plaintext
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { securityConfig } from '../SecurityConfig';
import { auditLogger } from './AuditLoggerService';

const prisma = new PrismaClient();

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  expiresInDays?: number;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key: string; // Only returned once at creation time
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyScope {
  name: string;
  description: string;
  permissions: string[];
}

// Default scopes
export const API_KEY_SCOPES: Record<string, ApiKeyScope> = {
  read: {
    name: 'read',
    description: 'Read-only access to resources',
    permissions: ['read'],
  },
  write: {
    name: 'write',
    description: 'Read and write access to resources',
    permissions: ['read', 'write'],
  },
  admin: {
    name: 'admin',
    description: 'Full administrative access',
    permissions: ['read', 'write', 'delete', 'admin'],
  },
};

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = 'nepa'): {
  key: string;
  keyHash: string;
  keyPrefix: string;
} {
  const keyLength = securityConfig.apiKey.keyLength;
  const randomBytes = crypto.randomBytes(keyLength);
  const key = `${prefix}_sk_${randomBytes.toString('base64url')}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = `${prefix}_sk_${randomBytes.toString('base64url').substring(0, 8)}`;

  return {
    key,
    keyHash,
    keyPrefix,
  };
}

/**
 * Hash an API key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify an API key
 */
export async function verifyApiKey(
  key: string
): Promise<{
  valid: boolean;
  apiKey?: any;
  error?: string;
}> {
  if (!securityConfig.apiKey.enabled) {
    return { valid: false, error: 'API key authentication disabled' };
  }

  const keyHash = hashApiKey(key);

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        isRevoked: false,
      },
      include: {
        user: true,
      },
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { valid: true, apiKey };
  } catch (error) {
    console.error('Error verifying API key:', error);
    return { valid: false, error: 'API key verification failed' };
  }
}

/**
 * Create an API key for a user
 */
export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
  ipAddress?: string
): Promise<{
  success: boolean;
  apiKey?: ApiKeyResponse;
  error?: string;
}> {
  if (!securityConfig.apiKey.enabled) {
    return { success: false, error: 'API key authentication disabled' };
  }

  try {
    // Check max keys per user
    const existingKeys = await prisma.apiKey.count({
      where: { userId, isRevoked: false },
    });

    if (existingKeys >= securityConfig.apiKey.maxKeysPerUser) {
      return { 
        success: false, 
        error: `Maximum number of API keys (${securityConfig.apiKey.maxKeysPerUser}) reached` 
      };
    }

    // Validate scopes
    const validScopes = Object.keys(API_KEY_SCOPES);
    for (const scope of input.scopes) {
      if (!validScopes.includes(scope)) {
        return { success: false, error: `Invalid scope: ${scope}` };
      }
    }

    // Generate API key
    const { key, keyHash, keyPrefix } = generateApiKey('nepa');

    // Calculate expiration
    const expiresInDays = input.expiresInDays || securityConfig.apiKey.defaultExpirationDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create API key in database
    const apiKey = await prisma.apiKey.create({
      data: {
        name: input.name,
        keyHash,
        keyPrefix,
        userId,
        scopes: input.scopes,
        expiresAt,
      },
    });

    // Log the API key creation
    await auditLogger.logApiKeyEvent(
      userId,
      'API_KEY_CREATED',
      apiKey.id,
      input.name,
      ipAddress
    );

    return {
      success: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key, // Only returned at creation time
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
    };
  } catch (error) {
    console.error('Error creating API key:', error);
    return { success: false, error: 'Failed to create API key' };
  }
}

/**
 * List API keys for a user
 */
export async function listApiKeys(
  userId: string
): Promise<{
  success: boolean;
  apiKeys?: any[];
  error?: string;
}> {
  if (!securityConfig.apiKey.enabled) {
    return { success: false, error: 'API key authentication disabled' };
  }

  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        isRevoked: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, apiKeys };
  } catch (error) {
    console.error('Error listing API keys:', error);
    return { success: false, error: 'Failed to list API keys' };
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  reason?: string,
  ipAddress?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!securityConfig.apiKey.enabled) {
    return { success: false, error: 'API key authentication disabled' };
  }

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    });

    if (!apiKey) {
      return { success: false, error: 'API key not found' };
    }

    if (apiKey.isRevoked) {
      return { success: false, error: 'API key already revoked' };
    }

    // Revoke the API key
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
        isActive: false,
      },
    });

    // Log the revocation
    await auditLogger.logApiKeyEvent(
      userId,
      'API_KEY_REVOKED',
      keyId,
      apiKey.name,
      ipAddress
    );

    return { success: true };
  } catch (error) {
    console.error('Error revoking API key:', error);
    return { success: false, error: 'Failed to revoke API key' };
  }
}

/**
 * Rotate an API key (revoke old, create new)
 */
export async function rotateApiKey(
  userId: string,
  keyId: string,
  name: string,
  scopes: string[],
  ipAddress?: string
): Promise<{
  success: boolean;
  newApiKey?: ApiKeyResponse;
  error?: string;
}> {
  // First revoke the old key
  const revokeResult = await revokeApiKey(userId, keyId, 'Rotated', ipAddress);
  
  if (!revokeResult.success) {
    return { success: false, error: revokeResult.error };
  }

  // Create a new key
  return createApiKey(userId, { name, scopes }, ipAddress);
}

/**
 * Check if an API key has a specific scope
 */
export function hasScope(apiKey: any, requiredScope: string): boolean {
  if (!apiKey || !apiKey.scopes) {
    return false;
  }

  // Admin scope has all permissions
  if (apiKey.scopes.includes('admin')) {
    return true;
  }

  return apiKey.scopes.includes(requiredScope);
}

/**
 * Express middleware for API key authentication
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip if API key authentication is disabled
  if (!securityConfig.apiKey.enabled) {
    return next();
  }

  // Check for API key in headers
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key in the X-API-Key header',
    });
  }

  // Verify the API key
  const result = await verifyApiKey(apiKey);

  if (!result.valid) {
    // Log failed API key attempt
    await auditLogger.log({
      eventType: 'PERMISSION_DENIED',
      userId: result.apiKey?.userId,
      ipAddress: req.ip,
      severity: 'medium',
      metadata: { reason: result.error },
    });

    return res.status(401).json({
      error: result.error,
    });
  }

  // Attach API key to request
  (req as any).apiKey = result.apiKey;
  (req as any).user = result.apiKey.user;
  
  next();
};

/**
 * Express middleware to require specific scope
 */
export const requireScope = (requiredScope: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = (req as any).apiKey;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
      });
    }

    if (!hasScope(apiKey, requiredScope)) {
      // Log permission failure
      await auditLogger.logPermissionFailure(
        apiKey.userId,
        'API_KEY',
        requiredScope,
        req.ip
      );

      return res.status(403).json({
        error: 'Insufficient permissions',
        requiredScope,
        currentScopes: apiKey.scopes,
      });
    }

    next();
  };
};

export default {
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  hasScope,
  apiKeyAuth,
  requireScope,
  API_KEY_SCOPES,
};
