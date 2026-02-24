import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../../middleware/logger';

const tracer = trace.getTracer('graphql-server');

export const traceGraphQLRequest = (operationName: string, fieldName: string, operation: string) => {
  const span = tracer.startSpan(`graphql.${operation}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'graphql.operation.name': operationName,
      'graphql.field.name': fieldName,
      'graphql.operation.type': operation,
    },
  });

  return span;
};

export const traceResolver = (resolverName: string, parentType: string) => {
  const span = tracer.startSpan(`graphql.resolver.${resolverName}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'graphql.resolver.name': resolverName,
      'graphql.resolver.parent': parentType,
    },
  });

  return span;
};

export const traceDataLoader = (loaderName: string, keys: string[]) => {
  const span = tracer.startSpan(`graphql.dataloader.${loaderName}`, {
    kind: SpanKind.INTERNAL,
    attributes: {
      'graphql.dataloader.name': loaderName,
      'graphql.dataloader.keys.count': keys.length,
      'graphql.dataloader.keys': JSON.stringify(keys),
    },
  });

  return span;
};

export const finishSpan = (span: any, error?: Error) => {
  if (error) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    logger.error('GraphQL operation failed', {
      error: error.message,
      stack: error.stack,
    });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  
  span.end();
};

// Middleware for tracing GraphQL operations
export const createTracingMiddleware = () => {
  return (resolve: any, parent: any, args: any, context: any, info: any) => {
    const span = traceResolver(info.fieldName, info.parentType.name);
    
    const startTime = Date.now();
    
    return Promise.resolve(resolve(parent, args, context, info))
      .then((result) => {
        const duration = Date.now() - startTime;
        span.setAttribute('graphql.resolver.duration', duration);
        finishSpan(span);
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        span.setAttribute('graphql.resolver.duration', duration);
        finishSpan(span, error);
        throw error;
      });
  };
};
