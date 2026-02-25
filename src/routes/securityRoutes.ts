/**
 * Security Routes
 * API routes for MFA and API Key management
 */

import { Router, Request, Response } from 'express';
import * as MfaModule from '../security/modules/MfaModule';
import * as ApiKeyModule from '../security/modules/ApiKeyModule';
import { authenticate } from '../../middleware/authentication';
import Joi from 'joi';

const router = Router();

// ==================== MFA Routes ====================

// Validation schemas
const enableMfaSchema = Joi.object({
  method: Joi.string().valid('AUTHENTICATOR_APP').default('AUTHENTICATOR_APP'),
});

const verifyMfaSchema = Joi.object({
  code: Joi.string().required().min(6).max(8),
});

const disableMfaSchema = Joi.object({
  reason: Joi.string().max(500).optional(),
});

// POST /auth/mfa/enable - Enable MFA for user
router.post('/auth/mfa/enable', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Validate request
    const { error, value } = enableMfaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Enable MFA
    const result = await MfaModule.enableMfa(user.id, user.email, value.method);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Return the secret and QR code (only once)
    res.status(201).json({
      message: 'MFA enabled successfully. Save your backup codes securely.',
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('Enable MFA error:', error);
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

// POST /auth/mfa/verify - Verify MFA code
router.post('/auth/mfa/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Validate request
    const { error, value } = verifyMfaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Verify MFA code
    const result = await MfaModule.verifyMfa(user.id, value.code, req.ip);

    if (!result.success) {
      return res.status(401).json({
        error: result.error,
        remainingAttempts: result.remainingAttempts,
      });
    }

    res.json({ message: 'MFA verification successful' });
  } catch (error) {
    console.error('Verify MFA error:', error);
    res.status(500).json({ error: 'Failed to verify MFA' });
  }
});

// POST /auth/mfa/disable - Disable MFA for user
router.post('/auth/mfa/disable', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Validate request
    const { error, value } = disableMfaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Disable MFA
    const result = await MfaModule.disableMfa(user.id, value.reason);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    console.error('Disable MFA error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// ==================== API Key Routes ====================

// Validation schemas
const createApiKeySchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  scopes: Joi.array().items(Joi.string().valid('read', 'write', 'admin')).min(1).required(),
  expiresInDays: Joi.number().integer().min(1).max(365).default(90),
});

const revokeApiKeySchema = Joi.object({
  reason: Joi.string().max(500).optional(),
});

// POST /api-keys - Create a new API key
router.post('/api-keys', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Validate request
    const { error, value } = createApiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Create API key
    const result = await ApiKeyModule.createApiKey(
      user.id,
      { name: value.name, scopes: value.scopes, expiresInDays: value.expiresInDays },
      req.ip
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Return the API key (only once at creation time)
    res.status(201).json({
      message: 'API key created successfully',
      apiKey: result.apiKey,
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET /api-keys - List all API keys for user
router.get('/api-keys', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // List API keys
    const result = await ApiKeyModule.listApiKeys(user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ apiKeys: result.apiKeys });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api-keys/:id - Revoke an API key
router.delete('/api-keys/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const keyId = req.params.id;
    
    // Validate request
    const { error, value } = revokeApiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Revoke API key
    const result = await ApiKeyModule.revokeApiKey(user.id, keyId, value.reason, req.ip);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// PUT /api-keys/:id/rotate - Rotate an API key
router.put('/api-keys/:id/rotate', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const keyId = req.params.id;
    
    // Validate request
    const { error, value } = createApiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // First get the old key name
    const listResult = await ApiKeyModule.listApiKeys(user.id);
    const oldKey = listResult.apiKeys?.find(k => k.id === keyId);
    
    if (!oldKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Rotate API key
    const result = await ApiKeyModule.rotateApiKey(
      user.id,
      keyId,
      value.name || oldKey.name,
      value.scopes,
      req.ip
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: 'API key rotated successfully',
      apiKey: result.newApiKey,
    });
  } catch (error) {
    console.error('Rotate API key error:', error);
    res.status(500).json({ error: 'Failed to rotate API key' });
  }
});

export default router;
