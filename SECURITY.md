# Advanced API Security Enhancement

This document describes the enterprise-level security features implemented in the NEPA application.

## Overview

The Advanced API Security Enhancement provides comprehensive security features that are fully backward compatible with the existing JWT-based authentication system. All new features are additive and can be enabled/disabled via environment variables.

## Table of Contents

1. [Security Configuration](#security-configuration)
2. [Multi-Factor Authentication (MFA)](#multi-factor-authentication-mfa)
3. [API Key Management](#api-key-management)
4. [Request Signing](#request-signing)
5. [Input Validation & Sanitization](#input-validation--sanitization)
6. [Security Monitoring](#security-monitoring)
7. [Rate Limiting](#rate-limiting)
8. [Audit Logging](#audit-logging)
9. [Compliance](#compliance)
10. [WAF Integration](#waf-integration)
11. [Environment Variables](#environment-variables)

---

## Security Configuration

All security features are configured via the `SecurityConfig` class located at [`src/security/SecurityConfig.ts`](src/security/SecurityConfig.ts).

### Default Configuration

```typescript
const defaultConfig: SecurityConfig = {
  mfa: {
    enabled: true,
    issuer: 'NEPA',
    windowSize: 1,
    backupCodesCount: 10,
    rateLimitMaxAttempts: 5,
    rateLimitWindowMs: 300000, // 5 minutes
  },
  apiKey: {
    enabled: true,
    keyLength: 32, // 256 bits
    hashAlgorithm: 'sha256',
    defaultExpirationDays: 90,
    maxKeysPerUser: 10,
    requireScope: true,
  },
  // ... more config options
};
```

---

## Multi-Factor Authentication (MFA)

### Features

- **TOTP-based authentication** (Google Authenticator compatible)
- **RFC 6238 compliant**
- **Encrypted secret storage**
- **Backup recovery codes** (10 codes generated on enable)
- **Rate limiting** on verification attempts
- **Non-breaking**: Existing users are NOT forced to enable MFA

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/mfa/enable` | POST | Enable MFA for user |
| `/auth/mfa/verify` | POST | Verify MFA code |
| `/auth/mfa/disable` | POST | Disable MFA for user |

### Enable MFA

```bash
curl -X POST /auth/mfa/enable \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"method": "AUTHENTICATOR_APP"}'
```

Response:
```json
{
  "message": "MFA enabled successfully. Save your backup codes securely.",
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", ...]
}
```

### Verify MFA

```bash
curl -X POST /auth/mfa/verify \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"code": "123456"}'
```

### Environment Variables

```env
SECURITY_MFA_ENABLED=true
MFA_ISSUER=NEPA
MFA_WINDOW_SIZE=1
MFA_BACKUP_CODES_COUNT=10
MFA_RATE_LIMIT_MAX_ATTEMPTS=5
MFA_RATE_LIMIT_WINDOW_MS=300000
```

---

## API Key Management

### Features

- **Secure 256-bit key generation**
- **Hashed key storage** (never store plaintext)
- **Scoped permissions** (read, write, admin)
- **Expiration support**
- **Key rotation**
- **Revocation**

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api-keys` | POST | Create new API key |
| `/api-keys` | GET | List all API keys |
| `/api-keys/:id` | DELETE | Revoke API key |
| `/api-keys/:id/rotate` | PUT | Rotate API key |

### Create API Key

```bash
curl -X POST /api-keys \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "scopes": ["read", "write"],
    "expiresInDays": 90
  }'
```

Response:
```json
{
  "message": "API key created successfully",
  "apiKey": {
    "id": "uuid",
    "name": "My API Key",
    "key": "nepa_sk_abc123...",  // Only returned once!
    "keyPrefix": "nepa_sk_abc1",
    "scopes": ["read", "write"],
    "expiresAt": "2024-06-01T00:00:00Z",
    "createdAt": "2024-03-01T00:00:00Z"
  }
}
```

### Use API Key

```bash
curl -X GET /api/protected-endpoint \
  -H "X-API-Key: nepa_sk_abc123..."
```

### Available Scopes

| Scope | Permissions |
|-------|-------------|
| `read` | Read-only access |
| `read`, `write` | Read and write access |
| `admin` | Full administrative access |

### Environment Variables

```env
SECURITY_API_KEY_ENABLED=true
API_KEY_LENGTH=32
API_KEY_HASH_ALGORITHM=sha256
API_KEY_EXPIRATION_DAYS=90
API_KEY_MAX_PER_USER=10
API_KEY_REQUIRE_SCOPE=true
```

---

## Request Signing

### Features

- **HMAC SHA256 request signing**
- **Timestamp validation** (prevents replay attacks)
- **Optional** - can be enabled per-endpoint or globally

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Signature` | Yes* | HMAC signature |
| `X-Timestamp` | Yes* | Unix timestamp (ms) |

*Required when `SECURITY_REQUIRE_SIGNATURE=true`

### Signature Generation

```javascript
const crypto = require('crypto');

function generateSignature(method, path, timestamp, body, secret) {
  const signatureString = `${method}:${path}:${timestamp}:${body}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signatureString)
    .digest('hex');
}
```

### Example Request

```javascript
const timestamp = Date.now().toString();
const body = JSON.stringify({ data: 'test' });
const signature = generateSignature('POST', '/api/users', timestamp, body, secret);

fetch('/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': signature,
    'X-Timestamp': timestamp,
  },
  body
});
```

### Environment Variables

```env
SECURITY_REQUEST_SIGNING_ENABLED=false
SECURITY_SIGNING_ALGORITHM=hmac-sha256
SECURITY_TIMESTAMP_TOLERANCE_MS=300000
SECURITY_REQUIRE_SIGNATURE=false
```

---

## Input Validation & Sanitization

### Features

- **Schema validation** using Joi
- **Strict DTO validation**
- **Strip unknown fields**
- **SQL injection prevention**
- **XSS prevention**
- **NoSQL injection prevention**
- **Prototype pollution prevention**
- **Input normalization**

### Available Middleware

```typescript
import { validateBody, validateQuery, validateParams, commonSchemas } from './security';

// Validate request body
router.post('/users', validateBody(userSchema), handler);

// Validate query parameters
router.get('/users', validateQuery(commonSchemas.pagination), handler);

// Validate URL parameters
router.get('/users/:id', validateParams(commonSchemas.uuidParam), handler);
```

### Dangerous Pattern Detection

The middleware automatically detects and blocks:
- SQL injection patterns
- NoSQL injection patterns
- Command injection attempts
- Path traversal attempts
- XSS attempts
- Prototype pollution

---

## Security Monitoring

### Features

- **Failed login tracking**
- **Token abuse detection**
- **API key usage monitoring**
- **IP-based anomaly detection**
- **Auto-blocking** for suspicious activity
- **Security alerts**

### Tracked Events

- Multiple failed login attempts (>5 in 15 minutes)
- Token abuse (>100 requests/24h)
- API key abuse (>10000 requests/24h)
- Multiple user accounts from same IP (>10 users)

### Alert Severity Levels

| Level | Description |
|-------|-------------|
| `low` | Informational |
| `medium` | Warning |
| `high` | Action required |
| `critical` | Auto-block enabled |

### Environment Variables

```env
SECURITY_MONITORING_ENABLED=true
SECURITY_LOG_LEVEL=info
SECURITY_ALERT_ON_SUSPICIOUS=true
SECURITY_FAILED_LOGIN_THRESHOLD=5
SECURITY_FAILED_LOGIN_WINDOW_MS=900000
SECURITY_TOKEN_ABUSE_THRESHOLD=100
SECURITY_IP_ANOMALY_DETECTION=true
SECURITY_GEO_LOCATION_CHECK=false
```

---

## Rate Limiting

### Features

- **Global rate limiting**
- **Per-user rate limiting**
- **Per-IP rate limiting**
- **Stricter limits for auth endpoints**
- **Sliding window algorithm**
- **Redis-backed** (with graceful fallback)

### Default Limits

| Type | Requests | Window |
|------|----------|--------|
| Global | 1000 | 15 minutes |
| Per-User | 500 | 15 minutes |
| Per-IP | 100 | 15 minutes |
| Auth | 10 | 15 minutes |
| MFA | 5 | 5 minutes |

### Response Headers

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 2024-03-01T00:15:00Z
X-RateLimit-Tier: standard
```

### Environment Variables

```env
SECURITY_RATE_LIMITING_ENABLED=true
RATE_LIMIT_GLOBAL=1000
RATE_LIMIT_GLOBAL_WINDOW_MS=900000
RATE_LIMIT_PER_USER=500
RATE_LIMIT_PER_USER_WINDOW_MS=900000
RATE_LIMIT_PER_IP=100
RATE_LIMIT_PER_IP_WINDOW_MS=900000
SECURITY_STRICT_AUTH_LIMITS=true
SECURITY_STRICT_MFA_LIMITS=true
```

---

## Audit Logging

### Features

- **Comprehensive audit trail**
- **Sensitive data exclusion**
- **Event filtering**
- **Compliance support**

### Logged Events

| Event Type | Description |
|------------|-------------|
| `LOGIN` | Successful login |
| `LOGIN_FAILED` | Failed login attempt |
| `LOGOUT` | User logout |
| `MFA_ENABLED` | MFA enabled |
| `MFA_DISABLED` | MFA disabled |
| `MFA_VERIFY_SUCCESS` | MFA verification success |
| `MFA_VERIFY_FAILED` | MFA verification failed |
| `API_KEY_CREATED` | New API key created |
| `API_KEY_REVOKED` | API key revoked |
| `PERMISSION_DENIED` | Permission denied |
| `SUSPICIOUS_ACTIVITY` | Suspicious activity detected |

### Log Format

```json
{
  "eventType": "LOGIN",
  "userId": "uuid",
  "ipAddress": "192.168.1.1",
  "severity": "low",
  "timestamp": "2024-03-01T00:00:00Z",
  "metadata": {}
}
```

### Excluded Data

The following is NEVER logged:
- Passwords
- API keys
- Tokens
- Secrets

### Environment Variables

```env
SECURITY_AUDIT_LOG_ENABLED=true
SECURITY_LOG_AUTH_ATTEMPTS=true
SECURITY_LOG_MFA_EVENTS=true
SECURITY_LOG_API_KEY_CREATION=true
SECURITY_LOG_PERMISSION_FAILURES=true
SECURITY_LOG_SUSPICIOUS_ACTIVITY=true
SECURITY_EXCLUDE_SENSITIVE_DATA=true
SECURITY_AUDIT_RETENTION_DAYS=365
```

---

## Compliance

### Features

- **OWASP API Security Top 10 aligned**
- **SOC 2 principles**
- **GDPR considerations**
- **Enhanced security headers**

### Headers Applied

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | Customizable |
| `Strict-Transport-Security` | 1 year |
| `X-Frame-Options` | DENY |
| `X-XSS-Protection` | 1; mode=block |
| `X-Content-Type-Options` | nosniff |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=(), payment=() |
| `Cross-Origin-Opener-Policy` | same-origin |
| `Cross-Origin-Resource-Policy` | same-origin |

### CORS Configuration

```env
CORS_ORIGINS=https://app.example.com,https://admin.example.com
CORS_CREDENTIALS=true
SECURITY_STRICT_HEADERS=true
HSTS_MAX_AGE=31536000
TRUST_PROXY=true
```

---

## WAF Integration

### Supported Providers

- **Cloudflare**
- **AWS WAF**
- **Custom WAF**

### Features

- **Blocked request detection**
- **WAF event logging**
- **IP forwarding**
- **Rule ID tracking**

### Headers Detected

| Provider | Header |
|----------|--------|
| Cloudflare | `cf-ray`, `cf-cf-ray`, `cf-country` |
| AWS WAF | `x-aws-waf-action`, `x-aws-waf-rule-id` |

### Environment Variables

```env
WAF_ENABLED=false
WAF_PROVIDER=cloudflare
WAF_DETECT_BLOCKED=true
WAF_LOG_EVENTS=true
```

---

## Environment Variables

### Complete List

```env
# MFA
SECURITY_MFA_ENABLED=true
MFA_ISSUER=NEPA
MFA_WINDOW_SIZE=1
MFA_BACKUP_CODES_COUNT=10
MFA_RATE_LIMIT_MAX_ATTEMPTS=5
MFA_RATE_LIMIT_WINDOW_MS=300000

# API Keys
SECURITY_API_KEY_ENABLED=true
API_KEY_LENGTH=32
API_KEY_HASH_ALGORITHM=sha256
API_KEY_EXPIRATION_DAYS=90
API_KEY_MAX_PER_USER=10
API_KEY_REQUIRE_SCOPE=true

# Request Signing
SECURITY_REQUEST_SIGNING_ENABLED=false
SECURITY_SIGNING_ALGORITHM=hmac-sha256
SECURITY_TIMESTAMP_TOLERANCE_MS=300000
SECURITY_REQUIRE_SIGNATURE=false

# Rate Limiting
SECURITY_RATE_LIMITING_ENABLED=true
RATE_LIMIT_GLOBAL=1000
RATE_LIMIT_GLOBAL_WINDOW_MS=900000
RATE_LIMIT_PER_USER=500
RATE_LIMIT_PER_USER_WINDOW_MS=900000
RATE_LIMIT_PER_IP=100
RATE_LIMIT_PER_IP_WINDOW_MS=900000
SECURITY_STRICT_AUTH_LIMITS=true
SECURITY_STRICT_MFA_LIMITS=true

# Monitoring
SECURITY_MONITORING_ENABLED=true
SECURITY_LOG_LEVEL=info
SECURITY_ALERT_ON_SUSPICIOUS=true
SECURITY_FAILED_LOGIN_THRESHOLD=5
SECURITY_FAILED_LOGIN_WINDOW_MS=900000
SECURITY_TOKEN_ABUSE_THRESHOLD=100
SECURITY_IP_ANOMALY_DETECTION=true
SECURITY_GEO_LOCATION_CHECK=false

# Audit Logging
SECURITY_AUDIT_LOG_ENABLED=true
SECURITY_LOG_AUTH_ATTEMPTS=true
SECURITY_LOG_MFA_EVENTS=true
SECURITY_LOG_API_KEY_CREATION=true
SECURITY_LOG_PERMISSION_FAILURES=true
SECURITY_LOG_SUSPICIOUS_ACTIVITY=true
SECURITY_EXCLUDE_SENSITIVE_DATA=true
SECURITY_AUDIT_RETENTION_DAYS=365

# Compliance
SECURITY_STRICT_HEADERS=true
CORS_ORIGINS=*
CORS_CREDENTIALS=true
HSTS_MAX_AGE=31536000
TRUST_PROXY=true

# CSP Directives
CSP_DEFAULT_SRC="'self'"
CSP_SCRIPT_SRC="'self'"
CSP_STYLE_SRC="'self' 'unsafe-inline'"
CSP_IMG_SRC="'self' data: https:"
CSP_FONT_SRC="'self'"
CSP_CONNECT_SRC="'self'"
CSP_FRAME_ANCESTORS="'none'"

# WAF
WAF_ENABLED=false
WAF_PROVIDER=cloudflare
WAF_DETECT_BLOCKED=true
WAF_LOG_EVENTS=true
```

---

## Migration

### Database Migration

To apply the new database schema:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

Or run the SQL migration directly:

```bash
psql -f prisma/migrations/20240225_add_advanced_security/migration.sql
```

---

## Testing

### Run Security Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# All tests
npm run test
```

---

## Backward Compatibility

All security features are:
- ✅ **Non-breaking**: Existing JWT auth works without changes
- ✅ **Feature-flagged**: Each feature can be enabled/disabled
- ✅ **Backward compatible**: Old API keys and sessions continue to work
- ✅ **Opt-in MFA**: Users are NOT forced to enable MFA

---

## License

MIT
