import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ResponseBuilder, HttpStatus, ErrorCode, RequestContext } from '../interfaces/ApiResponse';

/**
 * Base Controller Class
 * Provides standardized controller functionality with common patterns
 */
export abstract class BaseController {
  /**
   * Get request context
   */
  protected getContext(req: Request): RequestContext {
    return (req as any).context as RequestContext;
  }

  /**
   * Get authenticated user
   */
  protected getUser(req: Request): any {
    return (req as any).user;
  }

  /**
   * Get API version
   */
  protected getApiVersion(req: Request): string {
    return (req as any).apiVersion || 'v1';
  }

  /**
   * Validate required permissions
   */
  protected requirePermissions(permissions: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = this.getUser(req);
      
      if (!user) {
        return res.unauthorized('Authentication required');
      }

      const userPermissions = user.permissions || [];
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return res.forbidden('Insufficient permissions');
      }

      next();
    };
  }

  /**
   * Validate required role
   */
  protected requireRole(role: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = this.getUser(req);
      
      if (!user) {
        return res.unauthorized('Authentication required');
      }

      if (user.role !== role) {
        return res.forbidden(`Requires ${role} role`);
      }

      next();
    };
  }

  /**
   * Validate any of multiple roles
   */
  protected requireAnyRole(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = this.getUser(req);
      
      if (!user) {
        return res.unauthorized('Authentication required');
      }

      if (!roles.includes(user.role)) {
        return res.forbidden(`Requires one of: ${roles.join(', ')}`);
      }

      next();
    };
  }

  /**
   * Handle controller errors consistently
   */
  protected handleError(error: Error, req: Request, res: Response): void {
    const context = this.getContext(req);
    
    console.error('Controller Error:', {
      error: error.message,
      stack: error.stack,
      requestId: context?.requestId,
      userId: context?.userId,
      controller: this.constructor.name
    });

    // Handle specific error types
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
   * Validate pagination parameters
   */
  protected getPaginationParams(req: Request): {
    page: number;
    limit: number;
    offset: number;
    sort: string;
    order: 'asc' | 'desc';
  } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const sort = req.query.sort as string || 'createdAt';
    const order = (req.query.order as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    return { page, limit, offset, sort, order };
  }

  /**
   * Build pagination metadata
   */
  protected buildPaginationMeta(
    page: number,
    limit: number,
    total: number
  ): {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev
    };
  }

  /**
   * Async handler wrapper with error handling
   */
  protected asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(req, res);
      } catch (error) {
        this.handleError(error as Error, req, res);
      }
    };
  }

  /**
   * Validate request body with schema
   */
  protected validateBody<T>(req: Request, schema: any): T {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      throw new Error(`Validation failed: ${error.details[0].message}`);
    }
    
    return value as T;
  }

  /**
   * Validate request query with schema
   */
  protected validateQuery<T>(req: Request, schema: any): T {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      throw new Error(`Query validation failed: ${error.details[0].message}`);
    }
    
    return value as T;
  }

  /**
   * Validate request params with schema
   */
  protected validateParams<T>(req: Request, schema: any): T {
    const { error, value } = schema.validate(req.params);
    
    if (error) {
      throw new Error(`Parameter validation failed: ${error.details[0].message}`);
    }
    
    return value as T;
  }

  /**
   * Cache response helper
   */
  protected setCacheHeaders(res: Response, maxAge: number = 300): void {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    res.setHeader('ETag', `"${Date.now()}"`);
  }

  /**
   * Set no-cache headers
   */
  protected setNoCacheHeaders(res: Response): void {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  /**
   * Handle file upload response
   */
  protected handleFileUpload(res: Response, file: any): void {
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalname}"`);
    res.send(file.buffer);
  }

  /**
   * Stream response helper
   */
  protected streamResponse(res: Response, stream: any, filename?: string): void {
    if (filename) {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    stream.pipe(res);
  }

  /**
   * Health check endpoint
   */
  protected healthCheck(req: Request, res: Response): void {
    const context = this.getContext(req);
    
    res.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      apiVersion: this.getApiVersion(req),
      requestId: context?.requestId
    });
  }

  /**
   * API info endpoint
   */
  protected apiInfo(req: Request, res: Response): void {
    const context = this.getContext(req);
    
    res.success({
      name: 'NEPA API',
      version: '2.0.0',
      description: 'Standardized REST API for NEPA platform',
      endpoints: {
        authentication: '/auth',
        users: '/user',
        documents: '/documents',
        payments: '/payments',
        analytics: '/analytics'
      },
      features: [
        'Standardized responses',
        'API versioning',
        'Rate limiting',
        'Request validation',
        'Error handling',
        'Security headers',
        'API documentation'
      ],
      supportedVersions: ['v1', 'v2'],
      defaultVersion: 'v1',
      requestId: context?.requestId
    });
  }
}
