# Sophisticated Rate Limiting System

## Overview

This document describes the sophisticated rate limiting implementation for the NEPA API platform. The system provides multiple layers of protection against abuse, DDoS attacks, and unfair resource consumption while maintaining quality service for legitimate users.

## Architecture

### Core Components

#### 1. **Advanced Rate Limiter Middleware** (`middleware/advancedRateLimiter.ts`)
- Main middleware that enforces rate limits on all API requests
- Provides real-time rate limit checking and enforcement
- Integrates IP blocking, burst handling, and breach detection
- Returns comprehensive rate limit headers in responses

#### 2. **API Key Management Service** (`services/APIKeyManagementService.ts`)
- Manages API keys for external integrations and programmatic access
- Provides secure key generation and validation
- Supports key rotation and revocation
- Tracks per-key rate limiting and usage statistics

#### 3. **IP Blocking Service** (`services/IPBlockingService.ts`)
- Detects and blocks abusive IP addresses automatically
- Supports manual IP blocking and whitelisting
- Maintains audit trail of all blocking actions
- Provides DDOS pattern detection

#### 4. **Breach Notification Service** (`services/RateLimitBreachNotificationService.ts`)
- Sends real-time notifications when rate limits are breached
- Supports multiple notification channels (Email, Slack, PagerDuty, Webhooks, SMS)
- Allows customizable quiet hours and severity thresholds
- Tracks breach history for analytics

## Features

### 1. Tiered Rate Limiting

The system supports 5 tiers of rate limiting based on user subscription level:

| Tier | Requests/15min | Burst Capacity | Features |
|------|---|---|---|
| **FREE** | 100 | 20 | Basic burst handling |
| **BASIC** | 500 | 100 | Analytics, endpoint-specific rules |
| **PREMIUM** | 2000 | 400 | Custom rules, method-specific limits |
| **ENTERPRISE** | 10000 | 2000 | All features, priority support |
| **UNLIMITED** | Unlimited | Unlimited | Maximum features, no limits |

### 2. Redis-Based Distribution

- Uses Redis for distributed rate limiting across multiple servers
- Supports horizontal scaling without state synchronization issues
- Atomic operations ensure accurate request counting
- Automatic expiration of windows reduces memory usage

### 3. API Key Management

#### Key Features:
- **Secure Generation**: Cryptographically secure keys with hashing for storage
- **Granular Control**: Per-key rate limits and endpoint restrictions
- **Tier-Based Defaults**: Automatic limits based on key tier
- **Key Expiration**: Optional automatic expiration dates
- **Usage Tracking**: Detailed per-key usage statistics

#### Key Lifecycle:
```
Generate → Validate → Check Rate Limit → Track Usage → Revoke/Expire
```

### 4. Automatic IP Blocking

#### Detection Patterns:

**Rate Limit Breaches**
- Threshold: 10 breaches per hour
- Auto-block duration: 1 hour
- Severity: MEDIUM

**Failed Authentication**
- Threshold: 20 failed attempts per 15 minutes
- Auto-block duration: 1 hour
- Severity: MEDIUM

**Malicious Payloads**
- Threshold: 3 malicious requests per hour
- Auto-block duration: 24 hours
- Severity: HIGH

**DDOS Patterns**
- Threshold: 100 requests per 10 seconds
- Auto-block duration: 7 days
- Severity: CRITICAL

#### Manual Blocking:
Admins can manually block IPs with custom reasons and durations.

#### Whitelisting:
IP whitelist support for trusted partners and internal services.

### 5. Breach Notifications

#### Notification Channels:

**Email**
- Configurable recipients
- HTML-formatted messages with detailed information
- Supports multiple mailboxes

**Slack**
- Rich formatted messages with color coding
- Severity-based threading
- Custom channel routing

**PagerDuty**
- Critical breach escalation
- Automatic incident creation
- Integration with on-call schedules

**Webhooks**
- Custom HTTP endpoints
- Flexible payload formatting
- Ideal for custom integrations

**SMS**
- Direct phone notifications via Twilio
- High-priority breach alerts
- Critical incidents only

#### Quiet Hours:
- Suppress non-critical notifications during specified hours
- Configurable per user or globally
- Critical breaches always notify

## API Endpoints

### Rate Limit Analytics

```
GET /api/rate-limit/analytics
GET /api/rate-limit/breaches
```

### API Key Management

```
POST   /api/rate-limit/api-keys/generate        # Generate new key
GET    /api/rate-limit/api-keys                 # List user's keys
GET    /api/rate-limit/api-keys/:keyId          # Get key details
POST   /api/rate-limit/api-keys/:keyId/revoke   # Revoke key
GET    /api/rate-limit/api-keys/:keyId/usage    # Get usage stats
```

### IP Blocking Management

```
GET    /api/rate-limit/ip-blocking/blocked                # List blocked IPs
POST   /api/rate-limit/ip-blocking/block                  # Block an IP
POST   /api/rate-limit/ip-blocking/unblock                # Unblock an IP
POST   /api/rate-limit/ip-blocking/whitelist              # Whitelist an IP
```

### Notification Settings

```
GET    /api/rate-limit/notifications/preferences          # Get preferences
POST   /api/rate-limit/notifications/preferences          # Update preferences
GET    /api/rate-limit/breach-history                     # Breach history
```

## Usage Examples

### 1. Generate an API Key

```bash
curl -X POST https://api.example.com/api/rate-limit/api-keys/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App v1",
    "tier": "BASIC",
    "endpoints": ["/api/documents", "/api/users"],
    "description": "API key for mobile app",
    "expiresAt": "2025-12-31T23:59:59Z"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "keyId": "abc123def456",
    "apiKey": "abc123def456.xxxxxxxxxxxx",
    "message": "Keep this API key safe. You will not be able to see it again."
  }
}
```

### 2. Use API Key for Requests

```bash
curl https://api.example.com/api/documents \
  -H "X-API-Key: abc123def456.xxxxxxxxxxxx"

# Or using Bearer token
curl https://api.example.com/api/documents \
  -H "Authorization: Bearer abc123def456.xxxxxxxxxxxx"
```

### 3. Block a Malicious IP

```bash
curl -X POST https://api.example.com/api/rate-limit/ip-blocking/block \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "reason": "Attempted SQL injection attack",
    "severity": "CRITICAL"
  }'
```

### 4. Configure Breach Notifications

```bash
curl -X POST https://api.example.com/api/rate-limit/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [
      {
        "type": "email",
        "config": {
          "recipients": "alerts@example.com"
        },
        "enabled": true,
        "minSeverity": "HIGH"
      },
      {
        "type": "slack",
        "config": {
          "webhookUrl": "https://hooks.slack.com/services/...",
          "channel": "#alerts"
        },
        "enabled": true,
        "minSeverity": "MEDIUM"
      }
    ],
    "quietHours": {
      "start": 22,
      "end": 8
    }
  }'
```

## Configuration

### Environment Variables

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Email notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=password
SMTP_FROM=api-alerts@example.com
ADMIN_EMAIL=admin@example.com

# Slack notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# IP whitelisting
BLOCKED_IPS=192.168.1.1,192.168.1.2

# Rate limiting
RATE_LIMIT_ENABLED=true
```

## Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 500           # Limit for this window
X-RateLimit-Remaining: 495       # Remaining requests
X-RateLimit-Reset: 2025-02-25... # UTC timestamp when limit resets
X-RateLimit-Tier: BASIC          # User's tier
X-RateLimit-Burst: 5             # Current burst usage (if applicable)
Retry-After: 120                 # Seconds to wait before retrying (if 429)
```

## Monitoring and Analytics

### Key Metrics

- **Total Requests**: All requests processed
- **Blocked Requests**: Requests exceeding limits
- **Top Endpoints**: Endpoints with highest traffic
- **Top IPs**: IP addresses with most requests
- **Tier Distribution**: Usage by subscription tier
- **Breach Summary**: Breach statistics by type and severity

### Audit Trail

- All manual IP blocks/unblocks logged
- Breach events with full context preserved
- 30-day retention for audit logs
- Searchable and exportable records

## Security Best Practices

### For Users

1. **API Key Handling**
   - Never commit keys to version control
   - Rotate keys regularly
   - Use different keys for different applications
   - Set endpoint restrictions for each key
   - Use expiration dates for temporary access

2. **Rate Limit Response Handling**
   - Implement exponential backoff when rate limited
   - Respect `Retry-After` headers
   - Monitor `X-RateLimit-Remaining` proactively
   - Cache responses when possible

### For Administrators

1. **Monitoring**
   - Review breach history regularly
   - Monitor IP blocking patterns
   - Set up alerts for unusual activity
   - Track API key usage

2. **Configuration**
   - Adjust tier limits based on actual usage
   - Enable appropriate notification channels
   - Maintain IP whitelist for critical services
   - Review and revoke unused API keys

## Performance Considerations

### Redis Optimization
- Pre-allocated connection pooling
- Pipelined operations for batch updates
- Sliding window algorithm for efficiency
- Automatic cleanup of expired entries

### Database Impact
- Minimal database queries (mostly in-memory via Redis)
- Async breach notifications to prevent blocking
- Efficient indexing on frequently queried fields
- Configurable retention periods

## Troubleshooting

### Issue: Getting 429 Too Many Requests

**Solution**: Check your rate limit remaining and reset time in response headers. Implement exponential backoff and respect the `Retry-After` header.

### Issue: API Key Not Working

**Solution**: 
1. Verify key is active (not revoked)
2. Check key hasn't expired
3. Ensure endpoint is in key's allowed list
4. Verify key tier has appropriate limits

### Issue: IP Blocked Unexpectedly

**Solution**:
1. Check if IP is in blocked list: `GET /api/rate-limit/ip-blocking/blocked`
2. Request unblock from administrator
3. Check abuse statistics: IP blocking service tracks patterns

### Issue: Notifications Not Being Sent

**Solution**:
1. Verify notification preferences are configured
2. Check notification channel credentials
3. Review breach history to see detected breaches
4. Verify minimum severity threshold is met
5. Check if within quiet hours

## Future Enhancements

- [ ] Machine learning-based anomaly detection
- [ ] Geo-location based rate limiting
- [ ] GraphQL-specific rate limiting
- [ ] Webhook replay and retry mechanism
- [ ] Rate limit quota trading between users
- [ ] Advanced analytics dashboard

## References

- [Redis Rate Limiting](https://redis.io/topics/rate-limiting)
- [OWASP Rate Limiting Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Prevention_Cheat_Sheet.html)
- [API Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
