import { GraphQLError } from 'graphql';
import { ValidationError } from './errorHandling';

// Input validation utilities
export class InputValidator {
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      throw new ValidationError('Password must contain at least one lowercase letter');
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }
    
    if (!/(?=.*\d)/.test(password)) {
      throw new ValidationError('Password must contain at least one number');
    }
  }

  static validatePhoneNumber(phone: string): void {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      throw new ValidationError('Invalid phone number format');
    }
  }

  static validateUUID(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError('Invalid ID format');
    }
  }

  static validateAmount(amount: number): void {
    if (amount <= 0) {
      throw new ValidationError('Amount must be greater than 0');
    }
    
    if (amount > 999999.99) {
      throw new ValidationError('Amount exceeds maximum allowed value');
    }
  }

  static validateDate(date: string): void {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      throw new ValidationError('Invalid date format');
    }
    
    if (parsedDate < new Date('2000-01-01')) {
      throw new ValidationError('Date cannot be before year 2000');
    }
  }

  static validateFutureDate(date: string): void {
    this.validateDate(date);
    const parsedDate = new Date(date);
    if (parsedDate <= new Date()) {
      throw new ValidationError('Date must be in the future');
    }
  }

  static validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new ValidationError('Invalid URL format');
    }
  }

  static validateWalletAddress(address: string): void {
    // Stellar wallet address validation (simplified)
    if (!address.startsWith('G') || address.length !== 56) {
      throw new ValidationError('Invalid Stellar wallet address format');
    }
  }

  static validatePagination(first?: number, after?: string): void {
    if (first !== undefined) {
      if (first < 1) {
        throw new ValidationError('First must be at least 1');
      }
      
      if (first > 100) {
        throw new ValidationError('First cannot exceed 100');
      }
    }
    
    if (after !== undefined) {
      try {
        const decoded = Buffer.from(after, 'base64').toString();
        const cursor = parseInt(decoded);
        if (isNaN(cursor) || cursor < 0) {
          throw new ValidationError('Invalid cursor format');
        }
      } catch {
        throw new ValidationError('Invalid cursor format');
      }
    }
  }

  static validateUserRole(role: string): void {
    const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(role)) {
      throw new ValidationError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
  }

  static validateUserStatus(status: string): void {
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static validatePaymentMethod(method: string): void {
    const validMethods = ['BANK_TRANSFER', 'CREDIT_CARD', 'CRYPTO', 'STELLAR'];
    if (!validMethods.includes(method)) {
      throw new ValidationError(`Invalid payment method. Must be one of: ${validMethods.join(', ')}`);
    }
  }

  static validateBillStatus(status: string): void {
    const validStatuses = ['PENDING', 'PAID', 'OVERDUE'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid bill status. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static validatePaymentStatus(status: string): void {
    const validStatuses = ['SUCCESS', 'FAILED', 'PENDING'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid payment status. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static validateTwoFactorMethod(method: string): void {
    const validMethods = ['NONE', 'EMAIL', 'SMS', 'AUTHENTICATOR_APP'];
    if (!validMethods.includes(method)) {
      throw new ValidationError(`Invalid 2FA method. Must be one of: ${validMethods.join(', ')}`);
    }
  }

  static validateCouponType(type: string): void {
    const validTypes = ['PERCENTAGE', 'FIXED'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Invalid coupon type. Must be one of: ${validTypes.join(', ')}`);
    }
  }

  static validateWebhookEvents(events: string[]): void {
    const validEvents = [
      'user.created',
      'user.updated',
      'bill.created',
      'bill.updated',
      'payment.processed',
      'payment.updated',
      'document.uploaded',
      'webhook.triggered',
      'report.generated',
    ];

    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new ValidationError(`Invalid webhook event: ${event}. Must be one of: ${validEvents.join(', ')}`);
      }
    }
  }

  static validateFileUpload(file: any): void {
    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new ValidationError('File size cannot exceed 10MB');
    }

    // Check file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new ValidationError(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`);
    }
  }

  static validateReportParameters(parameters: any): void {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new ValidationError('Report parameters must be an object');
    }

    // Validate date range if present
    if (parameters.startDate) {
      this.validateDate(parameters.startDate);
    }

    if (parameters.endDate) {
      this.validateDate(parameters.endDate);
    }

    if (parameters.startDate && parameters.endDate) {
      const start = new Date(parameters.startDate);
      const end = new Date(parameters.endDate);
      
      if (start >= end) {
        throw new ValidationError('Start date must be before end date');
      }
    }

    // Validate limit if present
    if (parameters.limit !== undefined) {
      if (parameters.limit < 1 || parameters.limit > 10000) {
        throw new ValidationError('Report limit must be between 1 and 10000');
      }
    }
  }
}

// Validation middleware for GraphQL resolvers
export const validateInput = (validationRules: Array<(args: any) => void>) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (parent: any, args: any, context: any, info: any) {
      // Run all validation rules
      for (const rule of validationRules) {
        rule(args);
      }

      // Call the original method
      return await method.apply(this, [parent, args, context, info]);
    };

    return descriptor;
  };
};

// Common validation rule creators
export const ValidationRules = {
  requireAuth: () => (args: any, context: any) => {
    if (!context.user) {
      throw new ValidationError('Authentication required');
    }
  },

  requireAdmin: () => (args: any, context: any) => {
    if (!context.user || context.user.role !== 'ADMIN') {
      throw new ValidationError('Admin access required');
    }
  },

  validateId: (fieldName: string = 'id') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validateUUID(args[fieldName]);
    }
  },

  validateEmail: (fieldName: string = 'email') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validateEmail(args[fieldName]);
    }
  },

  validatePassword: (fieldName: string = 'password') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validatePassword(args[fieldName]);
    }
  },

  validateAmount: (fieldName: string = 'amount') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validateAmount(args[fieldName]);
    }
  },

  validateDate: (fieldName: string = 'date') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validateDate(args[fieldName]);
    }
  },

  validateFutureDate: (fieldName: string = 'date') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validateFutureDate(args[fieldName]);
    }
  },

  validatePagination: () => (args: any) => {
    InputValidator.validatePagination(args.first, args.after);
  },

  validatePaymentMethod: (fieldName: string = 'method') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validatePaymentMethod(args[fieldName]);
    }
  },

  validateUserRole: (fieldName: string = 'role') => (args: any) => {
    if (args[fieldName]) {
      InputValidator.validateUserRole(args[fieldName]);
    }
  },
};
