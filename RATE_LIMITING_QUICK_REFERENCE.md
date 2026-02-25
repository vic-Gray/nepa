# Rate Limiting Quick Reference Guide

## For API Consumers

### Getting Started with API Keys

1. **Generate a key** (as authenticated user):
```bash
curl -X POST https://api.example.com/api/rate-limit/api-keys/generate \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "tier": "BASIC"}'
```

2. **Use the key** in requests:
```bash
# Method 1: X-API-Key header
curl https://api.example.com/api/documents \
  -H "X-API-Key: YOUR_API_KEY"

# Method 2: Bearer token
curl https://api.example.com/api/documents \
  -H "Authorization: Bearer YOUR_API_KEY"
```

3. **Monitor rate limits** via response headers:
```
X-RateLimit-Limit: 500        ← Your allowed requests per window
X-RateLimit-Remaining: 495    ← How many you have left
X-RateLimit-Reset: ...        ← When it resets (ISO 8601)
```

### Rate Limit Tiers at a Glance

| Tier | Req/min | Burst | Best For |
|------|---------|-------|----------|
| FREE | ~7 | 20 | Development, testing |
| BASIC | ~33 | 100 | Small apps, MVPs |
| PREMIUM | ~133 | 400 | Growing products |
| ENTERPRISE | ~667 | 2000 | Large-scale apps |
| UNLIMITED | ∞ | ∞ | Mission-critical systems |

### What to Do When Rate Limited (429 Status)

```javascript
// Exponential backoff recommended
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = parseInt(error.headers['retry-after']) || 
                          Math.pow(2, attempt) * 100;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### Track Your Usage

```bash
GET https://api.example.com/api/rate-limit/api-keys/:keyId/usage \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## For Administrators

### Daily Operations

#### Check for Blocked IPs
```bash
curl https://api.example.com/api/rate-limit/ip-blocking/blocked \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

#### Block a Malicious IP
```bash
curl -X POST https://api.example.com/api/rate-limit/ip-blocking/block \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "203.0.113.45",
    "reason": "Excessive failed login attempts",
    "severity": "HIGH"
  }'
```

#### Whitelist a Partner IP
```bash
curl -X POST https://api.example.com/api/rate-limit/ip-blocking/whitelist \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "203.0.113.100"}'
```

#### Emergency Unblock
```bash
curl -X POST https://api.example.com/api/rate-limit/ip-blocking/unblock \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "203.0.113.45"}'
```

### Notification Setup

#### Configure Email Alerts
```bash
curl -X POST https://api.example.com/api/rate-limit/notifications/preferences \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [{
      "type": "email",
      "config": {"recipients": "ops@example.com"},
      "enabled": true,
      "minSeverity": "HIGH"
    }],
    "breachThreshold": 1,
    "enabled": true
  }'
```

#### Configure Slack Alerts
```bash
curl -X POST https://api.example.com/api/rate-limit/notifications/preferences \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [{
      "type": "slack",
      "config": {
        "webhookUrl": "https://hooks.slack.com/services/YOUR_HOOK",
        "channel": "#security-alerts"
      },
      "enabled": true,
      "minSeverity": "MEDIUM"
    }],
    "quietHours": {"start": 22, "end": 8}
  }'
```

### Analytics

```bash
# Get rate limit analytics for last 24 hours
curl https://api.example.com/api/rate-limit/analytics \
  -H "X-API-Key: YOUR_API_KEY"

# Get breach history
curl https://api.example.com/api/rate-limit/breaches \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## For Developers Using the Services

### Using APIKeyManagementService

```typescript
import { APIKeyManagementService } from './services/APIKeyManagementService';

const keyService = new APIKeyManagementService();

// Generate key
const { apiKey, keyId } = await keyService.generateAPIKey(
  userId,
  "Mobile App",
  {
    tier: 'PREMIUM',
    rateLimit: 2000,
    windowMs: 15 * 60 * 1000,
    endpoints: ['/api/documents', '/api/users'],
    expiresAt: new Date('2025-12-31')
  }
);

// Validate key
const validation = await keyService.validateAPIKey(req);
if (validation.valid) {
  const keyData = validation.keyData;
  // Use keyData
}

// Check rate limit
const result = await keyService.checkRateLimit(keyId, keyData);
if (!result.allowed) {
  // Return 429
}
```

### Using IPBlockingService

```typescript
import { IPBlockingService } from './services/IPBlockingService';

const ipService = new IPBlockingService();

// Record abuse
await ipService.recordAbuse(ip, 'RATE_LIMIT_BREACH', {
  endpoint: req.path,
  count: violations
});

// Check if blocked
const blockRecord = await ipService.isIPBlocked(ip);
if (blockRecord) {
  return res.status(403).json({ error: 'Blocked' });
}

// Block manually
await ipService.blockIP(ip, 'Manual block', 'HIGH');

// Get stats
const stats = await ipService.getAbuseStats(ip);
```

### Using RateLimitBreachNotificationService

```typescript
import { RateLimitBreachNotificationService } from './services/RateLimitBreachNotificationService';

const notificationService = new RateLimitBreachNotificationService();

// Send notification
await notificationService.notifyBreach({
  id: breachId,
  ip: clientIP,
  endpoint: '/api/users',
  breachType: 'RATE_LIMIT',
  severity: 'HIGH',
  timestamp: new Date(),
  details: { limit: 100, actual: 250 }
});

// Get history
const history = await notificationService.getBreachHistory(50);
```

---

## Common Patterns

### Express Middleware

```typescript
import { apiKeyRateLimiter } from './middleware/advancedRateLimiter';
import { advancedRateLimiter } from './middleware/advancedRateLimiter';

app.use('/api', advancedRateLimiter);
app.use('/api', apiKeyRateLimiter);

// Now all routes are protected by rate limiting
```

### Handling Rate Limit Errors

```typescript
app.use((err, req, res, next) => {
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: err.retryAfter,
      resetTime: err.resetTime
    });
  }
  
  if (err.status === 403) {
    return res.status(403).json({
      error: 'Access denied',
      reason: err.message
    });
  }
  
  next(err);
});
```

### Dashboard Display for Users

```javascript
function updateRateLimitDisplay(headers) {
  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = new Date(headers['x-ratelimit-reset']);
  const tier = headers['x-ratelimit-tier'];
  
  const percentage = (remaining / limit) * 100;
  
  console.log(`
    Tier: ${tier}
    Remaining: ${remaining}/${limit} (${percentage}%)
    Reset: ${reset.toLocaleString()}
  `);
}
```

---

## Troubleshooting Quick Answers

| Problem | Solution |
|---------|----------|
| Getting 429 errors | Check `X-RateLimit-Remaining`, implement backoff, use `Retry-After` |
| API key not working | Verify key is active, not expired, endpoint is allowed |
| IP getting blocked | Contact admin, request investigation, may appeal block |
| Notifications not coming | Check preferences, verify channel config, check severity threshold |
| Need higher limits | Contact sales, upgrade tier, or request custom limits |

---

## Rate Limit Window Reset

Rate limits reset on a rolling window basis, not at specific times:

- If you hit your limit at 14:30, you can't make more requests until 14:45
- If you hit it at 14:35, reset is at 14:50
- The `X-RateLimit-Reset` header shows your specific reset time

---

## Best Practices

✅ **DO**:
- Cache responses when possible
- Monitor `X-RateLimit-Remaining` proactively
- Use different API keys for different apps
- Rotate keys periodically
- Implement exponential backoff
- Use the lowest tier that meets your needs

❌ **DON'T**:
- Commit API keys to git
- Make requests in a tight loop
- Ignore rate limit headers
- Share keys between apps
- Use same key for different environments
- Request limits you don't actually need

---

**Last Updated**: February 25, 2026
**Version**: 1.0
