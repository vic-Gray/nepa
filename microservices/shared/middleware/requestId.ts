// Request ID middleware
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (serviceName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    res.locals.requestId = requestId;
    res.locals.serviceName = serviceName;
    res.setHeader('X-Request-ID', requestId);
    next();
  };
};
