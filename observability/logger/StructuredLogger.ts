// Structured logging with correlation IDs and distributed tracing
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { AsyncLocalStorage } from 'async_hooks';

// Context storage for request correlation
export const contextStorage = new AsyncLocalStorage<{
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
}>();

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const context = contextStorage.getStore();
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      service: process.env.SERVICE_NAME || 'nepa-service',
      message: info.message,
      correlationId: context?.correlationId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      userId: context?.userId,
      ...info.metadata,
    };

    if (info.stack) {
      logEntry.stack = info.stack;
    }

    return JSON.stringify(logEntry);
  })
);

// Create logger instance
export class StructuredLogger {
  private logger: winston.Logger;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: structuredFormat,
      defaultMeta: { service: serviceName },
      transports: [
        // Console output
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        
        // File output - All logs
        new DailyRotateFile({
          filename: `logs/${serviceName}/application-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info',
        }),
        
        // File output - Error logs
        new DailyRotateFile({
          filename: `logs/${serviceName}/error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error',
        }),
      ],
    });
  }

  private log(level: string, message: string, metadata?: any) {
    this.logger.log(level, message, { metadata });
  }

  info(message: string, metadata?: any) {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: any) {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: any) {
    this.log('error', message, {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  debug(message: string, metadata?: any) {
    this.log('debug', message, metadata);
  }

  // Business metrics logging
  metric(metricName: string, value: number, tags?: Record<string, string>) {
    this.info(`Metric: ${metricName}`, {
      metric: metricName,
      value,
      tags,
      type: 'metric',
    });
  }

  // Audit logging
  audit(action: string, resource: string, metadata?: any) {
    this.info(`Audit: ${action} on ${resource}`, {
      action,
      resource,
      ...metadata,
      type: 'audit',
    });
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: any) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      ...metadata,
      type: 'performance',
    });
  }
}

// Create service-specific loggers
export const createLogger = (serviceName: string) => new StructuredLogger(serviceName);

export default createLogger;
