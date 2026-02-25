import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ResponseBuilder, RequestContext, HttpStatus } from '../interfaces/ApiResponse';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to standardize API responses
 * Ensures consistent response format across all endpoints
 */
export class ApiResponseMiddleware {
  /**
   * Attach response helpers to the response object
   */
  static attachHelpers(req: Request, res: Response, next: NextFunction): void {
    // Generate request ID
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    
    // Create request context
    const context: RequestContext = {
      requestId,
      userId: (req as any).user?.id,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      startTime: Date.now(),
      version: req.headers['api-version'] as string || 'v1'
    };

    // Attach context to request
    (req as any).context = context;

    // Attach response helpers
    res.success = <T>(data: T, meta?: any) => {
      const response = ResponseBuilder.success(data, {
        ...meta,
        requestId
      });
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.OK);
    };

    res.created = <T>(data: T, meta?: any) => {
      const response = ResponseBuilder.created(data, {
        ...meta,
        requestId
      });
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.CREATED);
    };

    res.paginated = <T>(data: T[], pagination: any, meta?: any) => {
      const response = ResponseBuilder.paginated(data, pagination, {
        ...meta,
        requestId
      });
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.OK);
    };

    res.noContent = () => {
      const response = ResponseBuilder.noContent();
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.NO_CONTENT);
    };

    res.error = (code: string, message: string, statusCode?: HttpStatus, details?: any) => {
      const response = ResponseBuilder.error(code, message, statusCode, details);
      return ApiResponseMiddleware.sendResponse(res, response, statusCode || HttpStatus.BAD_REQUEST);
    };

    res.validationError = (errors: any[]) => {
      const response = ResponseBuilder.validationError(errors);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.BAD_REQUEST);
    };

    res.notFound = (resource?: string) => {
      const response = ResponseBuilder.notFound(resource);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.NOT_FOUND);
    };

    res.unauthorized = (message?: string) => {
      const response = ResponseBuilder.unauthorized(message);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.UNAUTHORIZED);
    };

    res.forbidden = (message?: string) => {
      const response = ResponseBuilder.forbidden(message);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.FORBIDDEN);
    };

    res.conflict = (message: string) => {
      const response = ResponseBuilder.conflict(message);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.CONFLICT);
    };

    res.tooManyRequests = (limit: number, resetTime: number, retryAfter?: number) => {
      const response = ResponseBuilder.tooManyRequests(limit, resetTime, retryAfter);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.TOO_MANY_REQUESTS);
    };

    res.internalError = (message?: string) => {
      const response = ResponseBuilder.internalError(message);
      return ApiResponseMiddleware.sendResponse(res, response, HttpStatus.INTERNAL_SERVER_ERROR);
    };

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-API-Version', context.version);

    next();
  }

  /**
   * Send standardized response with proper headers
   */
  private static sendResponse(res: Response, response: ApiResponse, statusCode: HttpStatus): void {
    // Calculate response time
    const responseTime = Date.now() - ((res.req as any).context?.startTime || Date.now());
    
    // Set standard headers
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Add CORS headers if not already set
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Version, X-Request-ID');
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Response-Time, X-Rate-Limit-Remaining');
    }

    res.status(statusCode).json(response);
  }

  /**
   * Error handling middleware
   */
  static errorHandler(
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const context = (req as any).context as RequestContext;
    
    // Log error with context
    console.error('API Error:', {
      error: error.message,
      stack: error.stack,
      requestId: context?.requestId,
      userId: context?.userId,
      ip: context?.ip,
      userAgent: context?.userAgent
    });

    // Handle different error types
    if (error.name === 'ValidationError') {
      return res.validationError([error]);
    }

    if (error.name === 'UnauthorizedError') {
      return res.unauthorized(error.message);
    }

    if (error.name === 'ForbiddenError') {
      return res.forbidden(error.message);
    }

    if (error.name === 'NotFoundError') {
      return res.notFound();
    }

    if (error.name === 'ConflictError') {
      return res.conflict(error.message);
    }

    // Default internal server error
    res.internalError(process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message);
  }

  /**
   * 404 handler
   */
  static notFoundHandler(req: Request, res: Response): void {
    res.notFound(`${req.method} ${req.path}`);
  }

  /**
   * Request logging middleware
   */
  static requestLogger(req: Request, res: Response, next: NextFunction): void {
    const context = (req as any).context as RequestContext;
    const startTime = Date.now();

    // Log request
    console.log('API Request:', {
      method: req.method,
      url: req.url,
      requestId: context?.requestId,
      userId: context?.userId,
      ip: context?.ip,
      userAgent: context?.userAgent,
      version: context?.version,
      contentLength: req.headers['content-length'],
      contentType: req.headers['content-type']
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data: any) {
      const responseTime = Date.now() - startTime;
      
      console.log('API Response:', {
        requestId: context?.requestId,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        contentLength: res.getHeader('content-length')
      });

      return originalJson.call(this, data);
    };

    next();
  }
}

/**
 * Custom error classes for better error handling
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
