// Shared response utilities
import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  metadata?: any
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
      service: res.locals.serviceName,
      ...metadata,
    },
  };
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
      service: res.locals.serviceName,
    },
  };
  res.status(statusCode).json(response);
};
