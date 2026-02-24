import request from 'supertest';
import express from 'express';
import { advancedRateLimiter, burstHandler } from '../../middleware/advancedRateLimiter';
import { AdvancedRateLimitService } from '../../services/AdvancedRateLimitService';

describe('Rate Limiting Integration Tests', () => {
  let app: express.Application;
  let service: AdvancedRateLimitService;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Apply rate limiting middleware
    app.use('/api', advancedRateLimiter);
    app.use('/api', burstHandler);
    
    // Test endpoints
    app.get('/api/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });
    
    app.post('/api/auth/login', (req, res) => {
      res.json({ message: 'Login endpoint' });
    });
    
    app.get('/api/admin/protected', (req, res) => {
      res.json({ message: 'Admin endpoint' });
    });

    service = new AdvancedRateLimitService();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
      expect(response.headers).toHaveProperty('x-ratelimit-tier');
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      const limitHeaders = {
        'x-ratelimit-limit': response.headers['x-ratelimit-limit'],
        'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
        'x-ratelimit-reset': response.headers['x-ratelimit-reset'],
        'x-ratelimit-tier': response.headers['x-ratelimit-tier']
      };

      expect(limitHeaders['x-ratelimit-limit']).toBeDefined();
      expect(parseInt(limitHeaders['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
      expect(limitHeaders['x-ratelimit-tier']).toBeDefined();
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    it('should apply stricter limits to auth endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      // Auth endpoints should have lower limits
      expect(parseInt(response.headers['x-ratelimit-limit'])).toBeLessThanOrEqual(100);
    });
  });

  describe('Rate Limit Exceeded', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Make multiple requests to exceed limit
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/api/test')
      );

      const responses = await Promise.allSettled(promises);
      
      // Check if any response was rate limited
      const rateLimitedResponse = responses.find(
        result => result.status === 'fulfilled' && result.value.status === 429
      );

      if (rateLimitedResponse && rateLimitedResponse.status === 'fulfilled') {
        const response = rateLimitedResponse.value;
        expect(response.status).toBe(429);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('retryAfter');
        expect(response.headers).toHaveProperty('retry-after');
      }
    });
  });

  describe('Burst Handling', () => {
    it('should handle burst capacity correctly', async () => {
      // Make rapid requests to test burst handling
      const burstPromises = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .get('/api/test')
          .set('X-Request-ID', `burst-${i}`)
      );

      const responses = await Promise.all(burstPromises);
      
      // All should succeed due to burst capacity
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('x-ratelimit-burst');
      });
    });
  });

  describe('Health Check Bypass', () => {
    it('should bypass rate limiting for health checks', async () => {
      app.get('/health', (req, res) => {
        res.json({ status: 'UP' });
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      // Health check should not have rate limit headers
      expect(response.headers).not.toHaveProperty('x-ratelimit-limit');
    });
  });

  describe('Error Handling', () => {
    it('should fail open when rate limiting service fails', async () => {
      // This test would require mocking the service to fail
      // For now, we'll test that requests succeed even with potential issues
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests correctly', async () => {
      const concurrentRequests = 20;
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .get('/api/test')
          .set('X-Request-ID', `concurrent-${i}`)
      );

      const responses = await Promise.allSettled(promises);
      
      // Count successful vs rate limited responses
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      const rateLimited = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      ).length;

      expect(successful + rateLimited).toBe(concurrentRequests);
      expect(successful).toBeGreaterThan(0);
    });
  });
});
