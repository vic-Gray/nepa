# Advanced API Rate Limiting and Throttling

This document describes the comprehensive rate limiting and throttling system implemented for the NEPA platform to protect API resources, ensure fair usage, and provide different tiers of service for different user types.

## Overview

The advanced rate limiting system provides:

- **Multi-tier rate limiting** with user-based policies
- **Advanced throttling** with burst handling capabilities
- **Endpoint-specific rate limiting** rules
- **Real-time analytics** and monitoring
- **Custom rate limiting policies** and rules
- **Role-based rate limiting** for different user permissions
- **Breach detection** and alerting
- **External API** for rate limiting management

## Architecture

### Core Components

1. **AdvancedRateLimitService** - Core service for rate limiting logic
2. **AdvancedRateLimiter Middleware** - Express middleware for request filtering
3. **RateLimitController** - API endpoints for rate limiting management
4. **Configuration System** - Tier definitions and rules
5. **Analytics Engine** - Real-time metrics and reporting

### Rate Limiting Tiers

The system supports five rate limiting tiers:

| Tier | Requests/Window | Window | Burst Capacity | Features |
|------|-----------------|--------|----------------|----------|
| FREE | 100 | 15 minutes | 20 | Basic protection |
| BASIC | 500 | 15 minutes | 100 | Analytics, endpoint-specific |
| PREMIUM | 2,000 | 15 minutes | 400 | Custom rules, method-specific |
| ENTERPRISE | 10,000 | 15 minutes | 2,000 | Full feature set |
| UNLIMITED | ∞ | 15 minutes | ∞ | No restrictions |

## Implementation Details

### User-Based Rate Limiting

Each user is assigned a rate limiting profile that determines their tier and custom limits:

```typescript
interface UserRateLimitProfile {
  userId: string;
  tier: RateLimitTier['name'];
  customLimits?: Record<string, number>;
  whitelist: boolean;
  blacklist: boolean;
  metadata: Record<string, any>;
}
```

### Endpoint-Specific Rules

Different endpoints can have custom rate limiting rules:

```typescript
// Authentication endpoints are more restrictive
{
  endpoint: '/api/auth/login',
  method: 'POST',
  tier: 'FREE',
  customLimit: 5,
  windowMs: 15 * 60 * 1000,
  burstCapacity: 2
}

// Payment processing has strict limits
{
  endpoint: '/api/payment/process',
  method: 'POST',
  tier: 'BASIC',
  customLimit: 10,
  windowMs: 5 * 60 * 1000,
  burstCapacity: 3
}
```

### Role-Based Multipliers

User roles affect rate limiting limits:

- **USER**: 1.0x (base multiplier)
- **ADMIN**: 2.0x (double the base limit)
- **SUPER_ADMIN**: 5.0x (five times the base limit)

### HTTP Method Multipliers

Different HTTP methods have different cost multipliers:

- **GET**: 1.0x
- **POST, PUT, PATCH**: 1.5x
- **DELETE**: 2.0x

## Usage Examples

### Basic Rate Limiting

```typescript
import { advancedRateLimiter } from './middleware/advancedRateLimiter';

// Apply to all API routes
app.use('/api', advancedRateLimiter);
```

### Role-Based Rate Limiting

```typescript
import { roleBasedRateLimiter } from './middleware/advancedRateLimiter';

// Admin-only endpoint with enhanced rate limiting
app.get('/api/admin/users', 
  authenticate, 
  roleBasedRateLimiter('ADMIN'),
  getUsersHandler
);
```

### Custom Rate Limiting

```typescript
import { AdvancedRateLimitService } from './services/AdvancedRateLimitService';

const service = new AdvancedRateLimitService();

// Set custom profile for a user
await service.setUserRateLimitProfile({
  userId: 'user123',
  tier: 'PREMIUM',
  whitelist: false,
  blacklist: false,
  customLimits: {
    '/api/custom': 1000
  },
  metadata: { source: 'enterprise_contract' }
});
```

## API Endpoints

### Analytics and Monitoring

#### Get Rate Limit Analytics
```http
GET /api/rate-limit/analytics?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z
Authorization: Bearer <token>
```

#### Get Breach History
```http
GET /api/rate-limit/breaches?limit=50
Authorization: Bearer <token>
```

### User Profile Management

#### Get User Rate Limit Profile
```http
GET /api/rate-limit/profile
Authorization: Bearer <token>
```

#### Update User Rate Limit Profile (Admin Only)
```http
PUT /api/rate-limit/profile/{userId}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "tier": "PREMIUM",
  "whitelist": false,
  "blacklist": false,
  "customLimits": {
    "/api/special": 500
  }
}
```

### Rate Limit Checking

#### Check Rate Limit Status
```http
POST /api/rate-limit/check
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user123",
  "endpoint": "/api/test",
  "method": "GET"
}
```

### Configuration

#### Get Available Tiers
```http
GET /api/rate-limit/tiers
Authorization: Bearer <token>
```

#### Get Endpoint Rules
```http
GET /api/rate-limit/rules
Authorization: Bearer <token>
```

## Response Headers

The system includes comprehensive rate limiting headers in all responses:

- `X-RateLimit-Limit`: Current rate limit for the endpoint
- `X-RateLimit-Remaining`: Number of requests remaining in the window
- `X-RateLimit-Reset`: Time when the rate limit window resets
- `X-RateLimit-Tier`: User's current rate limiting tier
- `X-RateLimit-Burst`: Current burst usage
- `X-RateLimit-Burst-Delay`: Applied burst delay (if any)
- `Retry-After`: Seconds to wait before retrying (when rate limited)

## Error Responses

### Rate Limit Exceeded (429)
```json
{
  "status": 429,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 100 per 15 minutes",
  "tier": "FREE",
  "retryAfter": 300,
  "resetTime": "2024-01-01T12:15:00.000Z"
}
```

### Access Denied (403)
```json
{
  "status": 403,
  "error": "Access denied",
  "message": "Your account has been restricted due to policy violations",
  "retryAfter": 300
}
```

## Configuration

### Environment Variables

```bash
# Redis configuration
REDIS_URL=redis://localhost:6379

# API key for external access
API_KEY=your-secret-api-key

# Rate limiting configuration
RATE_LIMIT_DEFAULT_TIER=FREE
RATE_LIMIT_BLOCK_DURATION=300000
RATE_LIMIT_ALERT_COOLDOWN=600000
```

### Custom Configuration

You can modify the rate limiting configuration by editing `config/rateLimitConfig.ts`:

```typescript
export const DEFAULT_RATE_LIMIT_TIERS = {
  FREE: {
    name: 'FREE',
    requestsPerWindow: 100,
    windowMs: 15 * 60 * 1000,
    burstCapacity: 20,
    priority: 1,
    features: {
      burstHandling: true,
      analytics: false,
      customRules: false,
      // ... other features
    }
  },
  // ... other tiers
};
```

## Monitoring and Alerting

### Breach Detection

The system automatically detects rate limit breaches and can trigger alerts:

```typescript
// Breach callback registration
rateLimitService.onBreach(async (breach) => {
  console.warn(`🚨 Rate Limit Breach:`, {
    id: breach.id,
    ip: breach.ip,
    endpoint: breach.endpoint,
    severity: breach.severity
  });
  
  // Send to monitoring systems
  await sendToSlack(breach);
  await sendToPagerDuty(breach);
});
```

### Analytics Dashboard

Access real-time analytics through the API:

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/rate-limit/analytics"
```

## Testing

### Unit Tests

Run unit tests for the rate limiting service:

```bash
npm test -- tests/unit/services/AdvancedRateLimitService.test.ts
```

### Integration Tests

Run integration tests for rate limiting middleware:

```bash
npm test -- tests/integration/rateLimiting.test.ts
```

### Load Testing

Test rate limiting under load:

```typescript
// Example load test
const promises = Array.from({ length: 1000 }, () =>
  fetch('http://localhost:3000/api/test')
);

const results = await Promise.allSettled(promises);
const successful = results.filter(r => r.status === 'fulfilled').length;
const rateLimited = results.filter(r => 
  r.status === 'fulfilled' && r.value.status === 429
).length;
```

## Performance Considerations

### Redis Optimization

- Use Redis clustering for high-traffic applications
- Configure appropriate memory limits and eviction policies
- Monitor Redis memory usage and performance

### Caching Strategy

- User profiles are cached for 5 minutes
- Rate limit counters use sliding windows
- Analytics data is retained for 30 days

### Scaling

- The system scales horizontally with Redis
- Each service instance shares the same Redis cluster
- Consider Redis persistence for critical data

## Security Considerations

### DDoS Protection

- Automatic IP blocking for suspicious patterns
- Progressive rate limiting for repeat offenders
- Integration with external DDoS protection services

### Data Privacy

- Rate limiting data is anonymized where possible
- IP addresses are stored temporarily
- User profiles respect privacy settings

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check Redis server status
   - Verify connection string
   - Monitor Redis memory usage

2. **Rate Limiting Not Working**
   - Ensure middleware is applied correctly
   - Check user authentication
   - Verify Redis keys and expiration

3. **Performance Issues**
   - Monitor Redis response times
   - Check for memory leaks
   - Review analytics retention settings

### Debug Mode

Enable debug logging:

```bash
DEBUG=rate-limit:* npm run dev
```

## Migration Guide

### From Basic Rate Limiting

1. Install the advanced rate limiting middleware
2. Update existing rate limiters to use the new system
3. Configure user tiers and profiles
4. Update monitoring and alerting
5. Test thoroughly before deployment

### Configuration Migration

```typescript
// Old configuration
const oldLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// New configuration
const newLimiter = advancedRateLimiter;
// User profiles and tiers handle the rest
```

## Best Practices

1. **Start with conservative limits** and adjust based on usage
2. **Monitor analytics regularly** to identify abuse patterns
3. **Use tiered pricing** to encourage upgrade to higher tiers
4. **Implement proper error handling** for rate limit exceeded scenarios
5. **Document rate limits** in API documentation
6. **Test under load** to ensure system stability
7. **Set up alerts** for critical breaches
8. **Review and update** rate limiting rules periodically

## Support and Contributing

For issues, questions, or contributions related to the rate limiting system:

1. Check existing documentation and issues
2. Create detailed bug reports with reproduction steps
3. Include performance metrics for optimization requests
4. Follow the contribution guidelines for code submissions

---

This advanced rate limiting system provides comprehensive protection for the NEPA API while ensuring fair usage and enabling different service tiers for various user types.
