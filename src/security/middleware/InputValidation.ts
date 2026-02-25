/**
 * Input Validation & Sanitization Middleware
 * Comprehensive input validation to prevent SQL injection, XSS, NoSQL injection, etc.
 * Uses Joi for schema validation with strict DTO validation
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { securityConfig } from '../SecurityConfig';

// Known dangerous patterns
const DANGEROUS_PATTERNS = {
  // SQL Injection patterns
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)|(--)|(;)|(\/\*|\*\/)|(\bOR\b.*=.*\bOR\b)/i,
  
  // NoSQL Injection patterns
  NOSQL_INJECTION: /(\$where|\$regex|\$ne|\$gt|\$lt|\$gte|\$lte|\$exists|\$type)\s*[:=]/i,
  
  // Command injection patterns
  COMMAND_INJECTION: /[;&|`$]/,
  
  // Path traversal patterns
  PATH_TRAVERSAL: /(\.\.[\/\\])|(%2e%2e)/i,
  
  // XSS patterns (basic)
  XSS_BASIC: /<script|javascript:|on\w+\s*=/i,
  
  // Prototype pollution
  PROTOTYPE_POLLUTION: /__proto__|constructor\.prototype/,
};

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove common XSS vectors
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  return sanitized;
}

/**
 * Check for dangerous patterns
 */
export function containsDangerousPattern(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  for (const [, pattern] of Object.entries(DANGEROUS_PATTERNS)) {
    if (pattern.test(input)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate and sanitize request body
 */
export function validateBody(schema: Joi.Schema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // First sanitize the body
      const sanitizedBody = sanitizeObject(req.body);
      req.body = sanitizedBody;

      // Then validate
      const { error, value } = schema.validate(sanitizedBody, {
        abortEarly: false,
        stripUnknown: true, // Remove unknown fields
        allowUnknown: false,
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          details: errorMessages,
        });
      }

      // Replace body with validated and sanitized value
      req.body = value;
      next();
    } catch (err) {
      console.error('Body validation error:', err);
      res.status(400).json({
        error: 'Invalid request body',
      });
    }
  };
}

/**
 * Validate and sanitize request query
 */
export function validateQuery(schema: Joi.Schema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize query parameters
      const sanitizedQuery = sanitizeObject(req.query);
      req.query = sanitizedQuery as Record<string, unknown>;

      const { error, value } = schema.validate(sanitizedQuery, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return res.status(400).json({
          error: 'Invalid query parameters',
          details: errorMessages,
        });
      }

      req.query = value as Record<string, unknown>;
      next();
    } catch (err) {
      console.error('Query validation error:', err);
      res.status(400).json({
        error: 'Invalid query parameters',
      });
    }
  };
}

/**
 * Validate and sanitize URL parameters
 */
export function validateParams(schema: Joi.Schema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize params
      const sanitizedParams = sanitizeObject(req.params);
      req.params = sanitizedParams as Record<string, string>;

      const { error, value } = schema.validate(sanitizedParams, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        return res.status(400).json({
          error: 'Invalid URL parameters',
          details: errorMessages,
        });
      }

      req.params = value as Record<string, string>;
      next();
    } catch (err) {
      console.error('Params validation error:', err);
      res.status(400).json({
        error: 'Invalid URL parameters',
      });
    }
  };
}

/**
 * Validate headers
 */
export function validateHeaders(schema: Joi.Schema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize headers (lowercase for case-insensitive matching)
      const sanitizedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          sanitizedHeaders[key] = sanitizeString(value);
        }
      }

      const { error, value } = schema.validate(sanitizedHeaders, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return res.status(400).json({
          error: 'Invalid headers',
          details: error.details.map(d => d.message),
        });
      }

      next();
    } catch (err) {
      console.error('Headers validation error:', err);
      res.status(400).json({
        error: 'Invalid headers',
      });
    }
  };
}

/**
 * Recursively sanitize an object
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check for prototype pollution
    if (key === '__proto__' || key === 'constructor.prototype') {
      console.warn('Blocked prototype pollution attempt:', key);
      continue;
    }

    sanitized[sanitizeString(key)] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Middleware to detect dangerous inputs
 */
export const detectDangerousInput = (req: Request, res: Response, next: NextFunction) => {
  // Check body
  if (req.body && containsDangerousPattern(JSON.stringify(req.body))) {
    console.warn('Dangerous pattern detected in request body:', {
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.id,
    });
  }

  // Check query
  if (req.query && containsDangerousPattern(JSON.stringify(req.query))) {
    console.warn('Dangerous pattern detected in query string:', {
      path: req.path,
      ip: req.ip,
    });
  }

  next();
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // UUID parameter
  uuidParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),

  // Email
  email: Joi.object({
    email: Joi.string().email().required(),
  }),

  // Search
  search: Joi.object({
    q: Joi.string().max(200).allow(''),
    filters: Joi.string().optional(),
  }),
};

export default {
  sanitizeString,
  containsDangerousPattern,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  sanitizeObject,
  detectDangerousInput,
  commonSchemas,
};
