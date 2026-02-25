import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiResponse, ResponseBuilder, HttpStatus, ErrorCode, ValidationError } from '../interfaces/ApiResponse';

/**
 * Request Validation Configuration
 */
interface ValidationConfig {
  schema: Joi.ObjectSchema;
  sanitize?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Request Validation Middleware
 * Provides standardized request validation and sanitization
 */
export class RequestValidation {
  /**
   * Validate request body
   */
  static validateBody(config: ValidationConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const options = {
          stripUnknown: config.stripUnknown !== false,
          abortEarly: config.abortEarly !== false,
          allowUnknown: false,
          convert: true
        };

        const { error, value } = config.schema.validate(req.body, options);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            code: detail.type
          }));

          return res.validationError(validationErrors);
        }

        // Sanitize data if requested
        if (config.sanitize) {
          req.body = RequestValidation.sanitizeData(value);
        } else {
          req.body = value;
        }

        next();
      } catch (err) {
        console.error('Validation middleware error:', err);
        return res.internalError('Validation failed');
      }
    };
  }

  /**
   * Validate request query parameters
   */
  static validateQuery(config: ValidationConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const options = {
          stripUnknown: config.stripUnknown !== false,
          abortEarly: config.abortEarly !== false,
          allowUnknown: false,
          convert: true
        };

        const { error, value } = config.schema.validate(req.query, options);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            code: detail.type
          }));

          return res.validationError(validationErrors);
        }

        req.query = value;
        next();
      } catch (err) {
        console.error('Query validation middleware error:', err);
        return res.internalError('Query validation failed');
      }
    };
  }

  /**
   * Validate request parameters
   */
  static validateParams(config: ValidationConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const options = {
          stripUnknown: config.stripUnknown !== false,
          abortEarly: config.abortEarly !== false,
          allowUnknown: false,
          convert: true
        };

        const { error, value } = config.schema.validate(req.params, options);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            code: detail.type
          }));

          return res.validationError(validationErrors);
        }

        req.params = value;
        next();
      } catch (err) {
        console.error('Params validation middleware error:', err);
        return res.internalError('Parameter validation failed');
      }
    };
  }

  /**
   * Validate request headers
   */
  static validateHeaders(config: ValidationConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const options = {
          stripUnknown: config.stripUnknown !== false,
          abortEarly: config.abortEarly !== false,
          allowUnknown: false,
          convert: true
        };

        const { error, value } = config.schema.validate(req.headers, options);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            code: detail.type
          }));

          return res.validationError(validationErrors);
        }

        // Merge validated headers with original headers
        Object.assign(req.headers, value);
        next();
      } catch (err) {
        console.error('Headers validation middleware error:', err);
        return res.internalError('Header validation failed');
      }
    };
  }

  /**
   * Validate file uploads
   */
  static validateFile(config: {
    required?: boolean;
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    maxFiles?: number;
  }) {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const files = (req as any).files;
        
        // Check if files exist
        if (config.required !== false && (!files || Object.keys(files).length === 0)) {
          return res.validationError([{
            field: 'file',
            message: 'File is required',
            code: 'required'
          }]);
        }

        // Check file count
        if (config.maxFiles && files && Object.keys(files).length > config.maxFiles) {
          return res.validationError([{
            field: 'files',
            message: `Maximum ${config.maxFiles} files allowed`,
            code: 'max_files'
          }]);
        }

        // Validate each file
        if (files) {
          for (const [fieldName, fileData] of Object.entries(files)) {
            const file = Array.isArray(fileData) ? fileData[0] : fileData;
            
            // Check file size
            if (config.maxSize && file.size > config.maxSize) {
              return res.validationError([{
                field: fieldName,
                message: `File size exceeds maximum allowed size of ${config.maxSize} bytes`,
                value: file.size,
                code: 'max_size'
              }]);
            }

            // Check file type
            if (config.allowedTypes && !config.allowedTypes.includes(file.mimetype)) {
              return res.validationError([{
                field: fieldName,
                message: `File type ${file.mimetype} is not allowed`,
                value: file.mimetype,
                code: 'invalid_type',
                allowedTypes: config.allowedTypes
              }]);
            }
          }
        }

        next();
      } catch (err) {
        console.error('File validation middleware error:', err);
        return res.internalError('File validation failed');
      }
    };
  }

  /**
   * Sanitize data to prevent XSS and injection attacks
   */
  static sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return RequestValidation.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => RequestValidation.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = RequestValidation.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = RequestValidation.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize string to prevent XSS
   */
  static sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      // Remove potentially dangerous characters
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Escape HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      // Remove SQL injection patterns
      .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi, '')
      // Trim whitespace
      .trim();
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination() {
    return RequestValidation.validateQuery({
      schema: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        sort: Joi.string().optional(),
        order: Joi.string().valid('asc', 'desc').default('desc')
      }),
      stripUnknown: true
    });
  }

  /**
   * Validate date range
   */
  static validateDateRange() {
    return RequestValidation.validateQuery({
      schema: Joi.object({
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
        timezone: Joi.string().optional()
      }),
      stripUnknown: true
    });
  }

  /**
   * Validate search parameters
   */
  static validateSearch() {
    return RequestValidation.validateQuery({
      schema: Joi.object({
        q: Joi.string().min(1).max(100).required(),
        fields: Joi.array().items(Joi.string()).optional(),
        filters: Joi.object().optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20)
      }),
      stripUnknown: true
    });
  }
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  
  // Email validation
  email: Joi.string().email().required(),
  
  // Password validation
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
  
  // Username validation
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),
  
  // Phone number validation
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .optional(),
  
  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  // Date range validation
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    timezone: Joi.string().optional()
  }),
  
  // File upload validation
  fileUpload: Joi.object({
    required: Joi.boolean().default(true),
    maxSize: Joi.number().integer().min(1),
    allowedTypes: Joi.array().items(Joi.string()),
    maxFiles: Joi.number().integer().min(1)
  })
};
