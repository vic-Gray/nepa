// Distributed tracing middleware using OpenTelemetry
import { Request, Response, NextFunction } from 'express';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';
import { contextStorage } from '../logger/StructuredLogger';

const tracer = trace.getTracer('nepa-service');

export interface TracingContext {
  traceId: string;
  spanId: string;
  correlationId: string;
  userId?: string;
}

export class TracingMiddleware {
  /**
   * Express middleware for distributed tracing
   */
  static middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
      const parentSpanContext = req.headers['x-trace-id'] as string;

      // Start a new span
      const span = tracer.startSpan(`${req.method} ${req.path}`, {
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': req.path,
          'http.host': req.hostname,
          'http.scheme': req.protocol,
          'http.user_agent': req.headers['user-agent'] || '',
          'correlation.id': correlationId,
        },
      });

      const spanContext = span.spanContext();
      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      // Store context for logging
      const tracingContext: TracingContext = {
        traceId,
        spanId,
        correlationId,
        userId: (req as any).user?.id,
      };

      // Set response headers
      res.setHeader('X-Trace-Id', traceId);
      res.setHeader('X-Span-Id', spanId);
      res.setHeader('X-Correlation-Id', correlationId);

      // Run the request in the context
      contextStorage.run(tracingContext, () => {
        context.with(trace.setSpan(context.active(), span), () => {
          // Capture response
          const originalSend = res.send;
          res.send = function (data: any) {
            span.setAttribute('http.status_code', res.statusCode);
            
            if (res.statusCode >= 400) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: `HTTP ${res.statusCode}`,
              });
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }

            span.end();
            return originalSend.call(this, data);
          };

          next();
        });
      });
    };
  }

  /**
   * Create a child span for a specific operation
   */
  static async traceOperation<T>(
    operationName: string,
    operation: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = tracer.startSpan(operationName, {
      attributes: attributes || {},
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        () => operation(span)
      );
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Trace database operations
   */
  static async traceDatabase<T>(
    operation: string,
    query: string,
    execute: () => Promise<T>
  ): Promise<T> {
    return this.traceOperation(
      `db.${operation}`,
      async (span) => {
        span.setAttribute('db.system', 'postgresql');
        span.setAttribute('db.statement', query);
        return execute();
      }
    );
  }

  /**
   * Trace external HTTP calls
   */
  static async traceHttpCall<T>(
    method: string,
    url: string,
    execute: () => Promise<T>
  ): Promise<T> {
    return this.traceOperation(
      `http.${method.toLowerCase()}`,
      async (span) => {
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', url);
        return execute();
      }
    );
  }
}

export default TracingMiddleware;
