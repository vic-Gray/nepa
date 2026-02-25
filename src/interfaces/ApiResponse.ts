/**
 * Standard API Response Interface
 * Provides consistent response format across all API endpoints
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
  timestamp: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  field?: string;
  stack?: string; // Only in development
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  version: string;
  rateLimit?: RateLimitMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface RateLimitMeta {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface ValidationError extends ApiError {
  field: string;
  value?: any;
}

/**
 * HTTP Status Codes
 */
export enum HttpStatus {
  // Success
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,

  // Redirection
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,

  // Client Errors
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,

  // Server Errors
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504
}

/**
 * Standard Error Codes
 */
export enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  // Authorization Errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  ROLE_REQUIRED = 'ROLE_REQUIRED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Business Logic Errors
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_TWO_FACTOR = 'INVALID_TWO_FACTOR',
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',

  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // File Upload Errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED'
}

/**
 * API Version Information
 */
export interface ApiVersion {
  version: string;
  deprecated?: boolean;
  deprecationDate?: string;
  sunsetDate?: string;
  migrationGuide?: string;
}

/**
 * Request Context Interface
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  ip: string;
  userAgent: string;
  startTime: number;
  version: string;
}

/**
 * Standardized Success Response Builder
 */
export class ResponseBuilder {
  static success<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        version: 'v1',
        ...meta
      },
      timestamp: new Date().toISOString()
    };
  }

  static created<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        version: 'v1',
        ...meta
      },
      timestamp: new Date().toISOString()
    };
  }

  static paginated<T>(
    data: T[], 
    pagination: PaginationMeta, 
    meta?: Partial<ResponseMeta>
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      meta: {
        version: 'v1',
        pagination,
        ...meta
      },
      timestamp: new Date().toISOString()
    };
  }

  static noContent(): ApiResponse {
    return {
      success: true,
      timestamp: new Date().toISOString()
    };
  }

  static error(
    code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: any,
    field?: string
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        field,
        ...(process.env.NODE_ENV === 'development' && { stack: new Error().stack })
      },
      timestamp: new Date().toISOString()
    };
  }

  static validationError(
    errors: ValidationError[]
  ): ApiResponse {
    return {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: errors
      },
      timestamp: new Date().toISOString()
    };
  }

  static notFound(resource: string = 'Resource'): ApiResponse {
    return ResponseBuilder.error(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found`,
      HttpStatus.NOT_FOUND
    );
  }

  static unauthorized(message: string = 'Unauthorized'): ApiResponse {
    return ResponseBuilder.error(
      ErrorCode.UNAUTHORIZED,
      message,
      HttpStatus.UNAUTHORIZED
    );
  }

  static forbidden(message: string = 'Access denied'): ApiResponse {
    return ResponseBuilder.error(
      ErrorCode.ACCESS_DENIED,
      message,
      HttpStatus.FORBIDDEN
    );
  }

  static conflict(message: string): ApiResponse {
    return ResponseBuilder.error(
      ErrorCode.CONFLICT,
      message,
      HttpStatus.CONFLICT
    );
  }

  static tooManyRequests(
    limit: number,
    resetTime: number,
    retryAfter?: number
  ): ApiResponse {
    return {
      success: false,
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests',
        details: {
          limit,
          resetTime: new Date(resetTime).toISOString()
        }
      },
      meta: {
        version: 'v1',
        rateLimit: {
          limit,
          remaining: 0,
          resetTime,
          retryAfter
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  static internalError(message: string = 'Internal server error'): ApiResponse {
    return ResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      message,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
