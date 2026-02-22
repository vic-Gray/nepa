import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationRule {
  field: string;
  rules: Joi.Schema;
  message?: string;
  sanitize?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: any;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'select' | 'textarea' | 'checkbox' | 'radio';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => string | null;
  sanitize?: boolean;
  dependencies?: string[];
  conditional?: {
    field: string;
    value: any;
    rules: Joi.Schema;
  };
}

export class FormValidator {
  private static instance: FormValidator;
  private validationCache: Map<string, ValidationResult> = new Map();

  static getInstance(): FormValidator {
    if (!FormValidator.instance) {
      FormValidator.instance = new FormValidator();
    }
    return FormValidator.instance;
  }

  // Create Joi schema from field configuration
  createSchema(fields: FormFieldConfig[]): Joi.ObjectSchema {
    const schemaObject: any = {};

    fields.forEach(field => {
      let schema: Joi.Schema;

      switch (field.type) {
        case 'email':
          schema = Joi.string().email();
          break;
        case 'password':
          schema = Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);
          break;
        case 'number':
          schema = Joi.number();
          break;
        case 'tel':
          schema = Joi.string().pattern(/^[+]?[\d\s\-()]+$/);
          break;
        case 'url':
          schema = Joi.string().uri();
          break;
        case 'date':
          schema = Joi.date();
          break;
        case 'checkbox':
          schema = Joi.boolean();
          break;
        default:
          schema = Joi.string();
      }

      // Apply common rules
      if (field.required) {
        schema = schema.required();
      } else {
        schema = schema.optional().allow('');
      }

      if (field.minLength && (field.type === 'text' || field.type === 'password' || field.type === 'textarea')) {
        schema = schema.min(field.minLength);
      }

      if (field.maxLength && (field.type === 'text' || field.type === 'password' || field.type === 'textarea')) {
        schema = schema.max(field.maxLength);
      }

      if (field.min !== undefined && field.type === 'number') {
        schema = schema.min(field.min);
      }

      if (field.max !== undefined && field.type === 'number') {
        schema = schema.max(field.max);
      }

      if (field.pattern) {
        schema = schema.pattern(field.pattern);
      }

      // Add custom validation
      if (field.customValidator) {
        schema = schema.custom((value, helpers) => {
          const error = field.customValidator!(value);
          if (error) {
            return helpers.error('custom', { message: error });
          }
          return value;
        });
      }

      schemaObject[field.name] = schema;
    });

    return Joi.object(schemaObject);
  }

  // Validate form data with real-time feedback
  validateField(
    fieldName: string, 
    value: any, 
    fields: FormFieldConfig[],
    formData?: any
  ): ValidationResult {
    const field = fields.find(f => f.name === fieldName);
    if (!field) {
      return { isValid: true, errors: [] };
    }

    const errors: ValidationError[] = [];

    // Check conditional validation
    if (field.conditional && formData) {
      const conditionMet = formData[field.conditional.field] === field.conditional.value;
      if (conditionMet) {
        const { error } = field.conditional.rules.validate(value);
        if (error) {
          errors.push({
            field: fieldName,
            message: error.details[0].message,
            value
          });
        }
      }
    } else {
      // Regular validation
      const schema = this.createSchema([field]);
      const { error, value: sanitizedValue } = schema.validate(value, {
        abortEarly: false,
        stripUnknown: field.sanitize
      });

      if (error) {
        error.details.forEach(detail => {
          errors.push({
            field: fieldName,
            message: field.message || detail.message,
            value
          });
        });
      }
    }

    // Custom validator
    if (field.customValidator) {
      const customError = field.customValidator(value);
      if (customError) {
        errors.push({
          field: fieldName,
          message: customError,
          value
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: field.sanitize ? value : undefined
    };
  }

  // Validate entire form
  validateForm(
    data: any, 
    fields: FormFieldConfig[],
    options: { 
      abortEarly?: boolean;
      sanitize?: boolean;
      cacheKey?: string;
    } = {}
  ): ValidationResult {
    const { abortEarly = false, sanitize = true, cacheKey } = options;

    // Check cache first
    if (cacheKey && this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const schema = this.createSchema(fields);
    const { error, value: sanitizedData } = schema.validate(data, {
      abortEarly,
      stripUnknown: sanitize
    });

    const errors: ValidationError[] = [];

    if (error) {
      error.details.forEach(detail => {
        const field = fields.find(f => f.name === detail.path[0]);
        errors.push({
          field: detail.path[0] as string,
          message: field?.message || detail.message,
          value: detail.context?.value
        });
      });
    }

    // Run custom validators
    fields.forEach(field => {
      if (field.customValidator) {
        const customError = field.customValidator(data[field.name]);
        if (customError) {
          errors.push({
            field: field.name,
            message: customError,
            value: data[field.name]
          });
        }
      }
    });

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      sanitizedData
    };

    // Cache result
    if (cacheKey) {
      this.validationCache.set(cacheKey, result);
    }

    return result;
  }

  // Sanitize input data
  sanitizeData(data: any, fields: FormFieldConfig[]): any {
    const sanitized: any = {};
    
    fields.forEach(field => {
      if (field.sanitize && data[field.name] !== undefined) {
        // Basic sanitization
        let value = data[field.name];
        
        if (typeof value === 'string') {
          value = value.trim();
          // Remove HTML tags
          value = value.replace(/<[^>]*>/g, '');
          // Escape special characters
          value = value.replace(/[<>"'&]/g, (match) => {
            const escapeMap: { [key: string]: string } = {
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#x27;',
              '&': '&amp;'
            };
            return escapeMap[match];
          });
        }
        
        sanitized[field.name] = value;
      } else if (data[field.name] !== undefined) {
        sanitized[field.name] = data[field.name];
      }
    });

    return sanitized;
  }

  // Clear validation cache
  clearCache(): void {
    this.validationCache.clear();
  }

  // Get field dependencies
  getFieldDependencies(fieldName: string, fields: FormFieldConfig[]): string[] {
    const field = fields.find(f => f.name === fieldName);
    return field?.dependencies || [];
  }
}

// Express middleware for form validation
export const validateForm = (fields: FormFieldConfig[], options: { sanitize?: boolean } = {}) => {
  const validator = FormValidator.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const result = validator.validateForm(req.body, fields, options);
    
    if (!result.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: result.errors
      });
    }
    
    // Attach sanitized data to request
    if (result.sanitizedData) {
      req.body = result.sanitizedData;
    }
    
    next();
  };
};

// Legacy validation function for backward compatibility
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details.map((detail) => detail.message).join(', ');
      return res.status(400).json({ error: errorMessage });
    }

    next();
  };
};