import { Request, Response, NextFunction } from 'express';
import { logger, correlationIdMiddleware, requestLogger } from '../services/logger';
import { errorTracker, errorHandler } from '../services/errorTracking';
import { performanceMiddleware } from '../services/performanceMonitoring';
import { analyticsMiddleware } from '../services/analytics';

export {
  logger,
  correlationIdMiddleware,
  requestLogger,
  errorHandler,
  errorTracker
};

export const loggingMiddleware = [
  correlationIdMiddleware,
  requestLogger,
  performanceMiddleware(),
  analyticsMiddleware(),
  errorTracker.getMiddleware()
];

export const setupGlobalErrorHandling = (app: any) => {
  app.use(errorHandler);
  
  process.on('uncaughtException', (error: Error) => {
    logger.logError(error, { context: 'uncaughtException' });
    errorTracker.captureException(error, { context: 'uncaughtException' });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.logError(error, { context: 'unhandledRejection', promise });
    errorTracker.captureException(error, { context: 'unhandledRejection' });
  });
};
