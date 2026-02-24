import { authenticate } from '../../middleware/authentication';
import { logger } from '../../middleware/logger';

export interface GraphQLContext {
  user?: any;
  req: any;
  res: any;
}

export const createContext = async ({ req, res }: { req: any; res: any }): Promise<GraphQLContext> => {
  try {
    // For GraphQL operations, we need to handle authentication
    const user = await authenticate(req, res);
    return { user, req, res };
  } catch (error) {
    // For public operations (login, register), we don't require authentication
    const operationName = req.body?.operationName;
    const publicOperations = ['login', 'register', 'IntrospectionQuery'];
    
    if (publicOperations.includes(operationName)) {
      return { req, res };
    }
    
    // Log authentication failure
    logger.warn('GraphQL authentication failed', {
      operationName,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    throw error;
  }
};
