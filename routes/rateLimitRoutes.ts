import { Request, Response, NextFunction } from 'express';
import { 
  advancedRateLimiter, 
  burstHandler, 
  roleBasedRateLimiter,
  rateLimitAnalyticsHandler,
  breachHistoryHandler,
  userProfileHandler
} from '../middleware/advancedRateLimiter';
import { 
  getRateLimitAnalytics,
  getBreachHistory,
  getUserRateLimitProfile,
  getAnyUserRateLimitProfile,
  updateUserRateLimitProfile,
  checkRateLimit,
  getRateLimitTiers,
  getRateLimitRules
} from '../controllers/RateLimitController';
import { authenticate, authorize } from '../middleware/authentication';
import { UserRole } from '../types/rateLimit';
import { apiKeyAuth } from '../src/config/auth';

export function setupRateLimitRoutes(app: any) {
  // Apply advanced rate limiting to all API routes
  app.use('/api', advancedRateLimiter);
  app.use('/api', burstHandler);

  // Rate limiting analytics endpoints
  app.get('/api/rate-limit/analytics', apiKeyAuth, rateLimitAnalyticsHandler);
  app.get('/api/rate-limit/breaches', apiKeyAuth, breachHistoryHandler);

  // User profile management endpoints
  app.get('/api/rate-limit/profile', authenticate, getUserRateLimitProfile);
  app.get('/api/rate-limit/profile/:userId', authenticate, authorize(UserRole.ADMIN), getAnyUserRateLimitProfile);
  app.put('/api/rate-limit/profile/:userId', authenticate, authorize(UserRole.ADMIN), updateUserRateLimitProfile);

  // Rate limit checking endpoint
  app.post('/api/rate-limit/check', apiKeyAuth, checkRateLimit);

  // Configuration endpoints
  app.get('/api/rate-limit/tiers', apiKeyAuth, getRateLimitTiers);
  app.get('/api/rate-limit/rules', apiKeyAuth, getRateLimitRules);

  // Role-specific rate limiting examples
  app.get('/api/admin/protected', authenticate, roleBasedRateLimiter(UserRole.ADMIN), (req, res) => {
    res.json({ message: 'Admin-only endpoint with role-based rate limiting' });
  });

  app.get('/api/premium/feature', authenticate, roleBasedRateLimiter(), (req, res) => {
    res.json({ message: 'Premium feature with enhanced rate limiting' });
  });
}
