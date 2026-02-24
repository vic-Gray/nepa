import { GraphQLError } from 'graphql';
import { logger } from '../../middleware/logger';

export class GraphQLErrorHandler {
  static handleAuthenticationError(message: string = 'Authentication required'): GraphQLError {
    logger.warn('GraphQL authentication error', { message });
    return new GraphQLError(message, {
      extensions: {
        code: 'UNAUTHORIZED',
        http: { status: 401 },
      },
    });
  }

  static handleAuthorizationError(message: string = 'Access denied'): GraphQLError {
    logger.warn('GraphQL authorization error', { message });
    return new GraphQLError(message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }

  static handleNotFoundError(resource: string): GraphQLError {
    logger.warn('GraphQL not found error', { resource });
    return new GraphQLError(`${resource} not found`, {
      extensions: {
        code: 'NOT_FOUND',
        http: { status: 404 },
      },
    });
  }

  static handleValidationError(message: string, details?: any): GraphQLError {
    logger.warn('GraphQL validation error', { message, details });
    return new GraphQLError(message, {
      extensions: {
        code: 'VALIDATION_ERROR',
        http: { status: 400 },
        details,
      },
    });
  }

  static handleRateLimitError(message: string = 'Rate limit exceeded'): GraphQLError {
    logger.warn('GraphQL rate limit error', { message });
    return new GraphQLError(message, {
      extensions: {
        code: 'RATE_LIMITED',
        http: { status: 429 },
      },
    });
  }

  static handleInternalError(error: Error, context?: string): GraphQLError {
    logger.error('GraphQL internal error', {
      message: error.message,
      stack: error.stack,
      context,
    });

    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const message = isDevelopment ? error.message : 'Internal server error';

    return new GraphQLError(message, {
      extensions: {
        code: 'INTERNAL_ERROR',
        http: { status: 500 },
        ...(isDevelopment && { stack: error.stack }),
      },
    });
  }

  static handleDatabaseError(error: Error, operation: string): GraphQLError {
    logger.error('GraphQL database error', {
      message: error.message,
      operation,
    });

    return new GraphQLError('Database operation failed', {
      extensions: {
        code: 'DATABASE_ERROR',
        http: { status: 500 },
        operation,
      },
    });
  }

  static handleSubscriptionError(error: Error, subscription: string): GraphQLError {
    logger.error('GraphQL subscription error', {
      message: error.message,
      subscription,
    });

    return new GraphQLError(`Subscription error: ${subscription}`, {
      extensions: {
        code: 'SUBSCRIPTION_ERROR',
        subscription,
      },
    });
  }
}

// Custom error classes for better error handling
export class AuthenticationError extends GraphQLError {
  constructor(message: string = 'Authentication required') {
    super(message, {
      extensions: {
        code: 'UNAUTHORIZED',
        http: { status: 401 },
      },
    });
  }
}

export class AuthorizationError extends GraphQLError {
  constructor(message: string = 'Access denied') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(resource: string) {
    super(`${resource} not found`, {
      extensions: {
        code: 'NOT_FOUND',
        http: { status: 404 },
      },
    });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message: string, details?: any) {
    super(message, {
      extensions: {
        code: 'VALIDATION_ERROR',
        http: { status: 400 },
        details,
      },
    });
  }
}

export class RateLimitError extends GraphQLError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, {
      extensions: {
        code: 'RATE_LIMITED',
        http: { status: 429 },
      },
    });
  }
}

// Error formatting middleware
export const formatError = (error: any) => {
  // If it's already a GraphQLError with extensions, return as-is
  if (error instanceof GraphQLError && error.extensions) {
    return error;
  }

  // Handle other error types
  if (error.name === 'ValidationError') {
    return GraphQLErrorHandler.handleValidationError(error.message, error.details);
  }

  if (error.name === 'CastError') {
    return GraphQLErrorHandler.handleValidationError('Invalid ID format');
  }

  if (error.code === 'P2002') {
    // Prisma unique constraint violation
    return GraphQLErrorHandler.handleValidationError('Resource already exists', {
      field: error.meta?.target,
    });
  }

  if (error.code === 'P2025') {
    // Prisma record not found
    return GraphQLErrorHandler.handleNotFoundError('Resource');
  }

  // Default to internal error
  return GraphQLErrorHandler.handleInternalError(error);
};

// Async error wrapper for resolvers
export const withErrorHandling = (resolver: Function) => {
  return async (parent: any, args: any, context: any, info: any) => {
    try {
      return await resolver(parent, args, context, info);
    } catch (error) {
      // Re-throw GraphQLErrors as-is
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Handle specific error types
      if (error.name === 'JsonWebTokenError') {
        throw GraphQLErrorHandler.handleAuthenticationError('Invalid token');
      }

      if (error.name === 'TokenExpiredError') {
        throw GraphQLErrorHandler.handleAuthenticationError('Token expired');
      }

      if (error.message.includes('ECONNREFUSED')) {
        throw GraphQLErrorHandler.handleInternalError(error, 'Database connection');
      }

      // Default error handling
      throw GraphQLErrorHandler.handleInternalError(error, info.fieldName);
    }
  };
};
