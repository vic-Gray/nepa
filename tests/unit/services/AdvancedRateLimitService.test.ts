import { AdvancedRateLimitService } from '../services/AdvancedRateLimitService';
import { RateLimitTierType, UserRole } from '../types/rateLimit';
import { DEFAULT_RATE_LIMIT_TIERS } from '../config/rateLimitConfig';

describe('AdvancedRateLimitService', () => {
  let service: AdvancedRateLimitService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      pipeline: jest.fn(() => ({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 1]])
      }))
    };

    // Mock Redis constructor
    jest.doMock('ioredis', () => jest.fn(() => mockRedis));
    
    service = new AdvancedRateLimitService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRateLimitProfile', () => {
    it('should return default profile for new user', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const profile = await service.getUserRateLimitProfile('test-user');

      expect(profile).toEqual({
        userId: 'test-user',
        tier: RateLimitTierType.FREE,
        whitelist: false,
        blacklist: false,
        metadata: {}
      });
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return cached profile', async () => {
      const cachedProfile = JSON.stringify({
        userId: 'test-user',
        tier: RateLimitTierType.PREMIUM,
        whitelist: false,
        blacklist: false,
        metadata: {}
      });
      mockRedis.get.mockResolvedValue(cachedProfile);

      const profile = await service.getUserRateLimitProfile('test-user');

      expect(profile.tier).toBe(RateLimitTierType.PREMIUM);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('getEffectiveRateLimit', () => {
    it('should return blocked tier for blacklisted user', async () => {
      const userProfile = {
        userId: 'test-user',
        tier: RateLimitTierType.BASIC,
        whitelist: false,
        blacklist: true,
        metadata: {}
      };

      const mockReq = {
        path: '/api/test',
        method: 'GET',
        user: { id: 'test-user' }
      } as any;

      const limit = await service.getEffectiveRateLimit(mockReq, userProfile);

      expect(limit.name).toBe('BLOCKED');
      expect(limit.requestsPerWindow).toBe(0);
    });

    it('should return unlimited tier for whitelisted user', async () => {
      const userProfile = {
        userId: 'test-user',
        tier: RateLimitTierType.BASIC,
        whitelist: true,
        blacklist: false,
        metadata: {}
      };

      const mockReq = {
        path: '/api/test',
        method: 'GET',
        user: { id: 'test-user' }
      } as any;

      const limit = await service.getEffectiveRateLimit(mockReq, userProfile);

      expect(limit.name).toBe(RateLimitTierType.UNLIMITED);
      expect(limit.requestsPerWindow).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should apply endpoint-specific rules', async () => {
      const userProfile = {
        userId: 'test-user',
        tier: RateLimitTierType.BASIC,
        whitelist: false,
        blacklist: false,
        metadata: {}
      };

      const mockReq = {
        path: '/api/auth/login',
        method: 'POST',
        user: { id: 'test-user' }
      } as any;

      const limit = await service.getEffectiveRateLimit(mockReq, userProfile);

      expect(limit.requestsPerWindow).toBe(5); // Custom limit for login endpoint
      expect(limit.windowMs).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should apply role-based multipliers', async () => {
      const userProfile = {
        userId: 'test-user',
        tier: RateLimitTierType.BASIC,
        whitelist: false,
        blacklist: false,
        metadata: {}
      };

      const mockReq = {
        path: '/api/test',
        method: 'GET',
        user: { id: 'test-user', role: UserRole.ADMIN }
      } as any;

      const limit = await service.getEffectiveRateLimit(mockReq, userProfile);

      const baseLimit = DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC];
      expect(limit.requestsPerWindow).toBe(baseLimit.requestsPerWindow * 2); // Admin multiplier
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', async () => {
      const tier = DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC];
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      } as any;

      mockRedis.pipeline.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 10]]) // Within limit
      });

      const result = await service.checkRateLimit(mockReq, tier);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block requests exceeding limit', async () => {
      const tier = DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC];
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      } as any;

      mockRedis.pipeline.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 600]]) // Exceeds limit
      });

      const result = await service.checkRateLimit(mockReq, tier);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle burst capacity', async () => {
      const tier = {
        ...DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC],
        features: { ...DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC].features, burstHandling: true },
        burstCapacity: 100
      };
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      } as any;

      mockRedis.incr.mockResolvedValue(50);
      mockRedis.expire.mockResolvedValue(1);

      const result = await service.checkRateLimit(mockReq, tier);

      expect(result.burstUsed).toBe(50);
      expect(mockRedis.incr).toHaveBeenCalledWith(
        expect.stringContaining(':burst:')
      );
    });
  });

  describe('detectBreach', () => {
    it('should create breach record for blocked request', async () => {
      const tier = DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC];
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      } as any;

      const result = {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 900000)
      };

      mockRedis.setex.mockResolvedValue('OK');

      const breach = await service.detectBreach(mockReq, tier, result);

      expect(breach).not.toBeNull();
      expect(breach!.breachType).toBe('RATE_LIMIT');
      expect(breach!.ip).toBe('127.0.0.1');
      expect(breach!.endpoint).toBe('/api/test');
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return null for allowed request', async () => {
      const tier = DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC];
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1'
      } as any;

      const result = {
        allowed: true,
        remaining: 100,
        resetTime: new Date(Date.now() + 900000)
      };

      const breach = await service.detectBreach(mockReq, tier, result);

      expect(breach).toBeNull();
    });
  });

  describe('getAnalytics', () => {
    it('should return empty analytics for no data', async () => {
      mockRedis.keys.mockResolvedValue([]);
      const timeWindow = {
        start: new Date(Date.now() - 86400000),
        end: new Date()
      };

      const analytics = await service.getAnalytics(timeWindow);

      expect(analytics.totalRequests).toBe(0);
      expect(analytics.blockedRequests).toBe(0);
      expect(analytics.topEndpoints).toHaveLength(0);
    });

    it('should process metrics correctly', async () => {
      const mockMetrics = [
        {
          userId: 'user1',
          ip: '127.0.0.1',
          endpoint: '/api/test',
          method: 'GET',
          timestamp: new Date(),
          blocked: false,
          remaining: 95,
          resetTime: new Date(Date.now() + 900000),
          tier: 'BASIC',
          breach: false
        },
        {
          userId: 'user2',
          ip: '192.168.1.1',
          endpoint: '/api/test',
          method: 'POST',
          timestamp: new Date(),
          blocked: true,
          remaining: 0,
          resetTime: new Date(Date.now() + 900000),
          tier: 'FREE',
          breach: true
        }
      ];

      mockRedis.keys.mockResolvedValue(['key1', 'key2']);
      mockRedis.pipeline.mockReturnValue({
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, JSON.stringify(mockMetrics[0])],
          [null, JSON.stringify(mockMetrics[1])]
        ])
      });

      const timeWindow = {
        start: new Date(Date.now() - 86400000),
        end: new Date()
      };

      const analytics = await service.getAnalytics(timeWindow);

      expect(analytics.totalRequests).toBe(2);
      expect(analytics.blockedRequests).toBe(1);
      expect(analytics.topEndpoints).toHaveLength(1);
      expect(analytics.topEndpoints[0].endpoint).toBe('/api/test');
      expect(analytics.topEndpoints[0].requests).toBe(2);
    });
  });

  describe('breach callbacks', () => {
    it('should trigger breach callbacks', async () => {
      const callback = jest.fn();
      service.onBreach(callback);

      const tier = DEFAULT_RATE_LIMIT_TIERS[RateLimitTierType.BASIC];
      const mockReq = {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0')
      } as any;

      const result = {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 900000)
      };

      mockRedis.setex.mockResolvedValue('OK');

      await service.detectBreach(mockReq, tier, result);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          breachType: 'RATE_LIMIT',
          ip: '127.0.0.1',
          endpoint: '/api/test'
        })
      );
    });
  });
});
