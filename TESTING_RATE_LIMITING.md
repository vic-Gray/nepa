# Rate Limiting System - Testing Guide

## Quick Start

### Prerequisites
```bash
# Start Redis (if not running)
docker run -d -p 6379:6379 redis:latest

# Install dependencies
npm install

# Set up environment
cp .env.example .env
```

---

## 1. Manual Testing with cURL

### Test 1: Generate an API Key

```bash
# First, get an auth token
AUTH_TOKEN="your_jwt_token_here"

# Generate API key
curl -X POST http://localhost:3000/api/rate-limit/api-keys/generate \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API Key",
    "tier": "BASIC",
    "endpoints": ["/*"],
    "description": "Test key for rate limiting"
  }'

# Save the apiKey from response for next tests
API_KEY="the_key_from_response"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "keyId": "abc-123",
    "apiKey": "abc-123.xxxxxxxxxxxxxxxxxxxx",
    "message": "Keep this API key safe..."
  }
}
```

---

### Test 2: Make Requests with API Key

```bash
# Single successful request
curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/documents

# Check rate limit headers
curl -i -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/documents | grep X-RateLimit

# Expected headers:
# X-RateLimit-Limit: 500
# X-RateLimit-Remaining: 499
# X-RateLimit-Reset: 2026-02-25T15:30:00.000Z
# X-RateLimit-Tier: BASIC
```

---

### Test 3: Hit Rate Limit (429 Response)

```bash
# Quick script to hit rate limit
API_KEY="your_api_key"
for i in {1..600}; do
  response=$(curl -s -w "\n%{http_code}" -H "X-API-Key: $API_KEY" \
    http://localhost:3000/api/documents)
  
  http_code=$(echo "$response" | tail -n1)
  
  if [ "$http_code" == "429" ]; then
    echo "Rate limited at request $i"
    echo "Response:"
    echo "$response" | head -n-1
    break
  fi
  
  if [ $((i % 100)) -eq 0 ]; then
    echo "Request $i: $http_code"
  fi
done
```

**Expected 429 Response:**
```json
{
  "status": 429,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 500 per 15 minutes",
  "tier": "BASIC",
  "retryAfter": 847,
  "resetTime": "2026-02-25T15:30:00.000Z"
}
```

---

### Test 4: Test API Key Revocation

```bash
KEY_ID="from_earlier_response"
AUTH_TOKEN="your_token"

# Revoke the key
curl -X POST http://localhost:3000/api/rate-limit/api-keys/$KEY_ID/revoke \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Try to use revoked key (should fail)
curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/documents

# Expected: 401 Unauthorized
```

---

### Test 5: Check API Key Usage

```bash
KEY_ID="from_earlier_response"
AUTH_TOKEN="your_token"

curl http://localhost:3000/api/rate-limit/api-keys/$KEY_ID/usage \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Expected:
# {
#   "success": true,
#   "data": {
#     "keyId": "abc-123",
#     "requests": 150,
#     "blockedRequests": 0,
#     "lastReset": "2026-02-25T14:00:00.000Z"
#   }
# }
```

---

### Test 6: Test IP Blocking

```bash
ADMIN_TOKEN="your_admin_token"

# Block an IP
curl -X POST http://localhost:3000/api/rate-limit/ip-blocking/block \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "203.0.113.45",
    "reason": "Excessive failed authentication attempts",
    "severity": "HIGH"
  }'

# Get list of blocked IPs
curl http://localhost:3000/api/rate-limit/ip-blocking/blocked \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Unblock an IP
curl -X POST http://localhost:3000/api/rate-limit/ip-blocking/unblock \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "203.0.113.45"}'

# Whitelist an IP
curl -X POST http://localhost:3000/api/rate-limit/ip-blocking/whitelist \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "203.0.113.100"}'
```

---

### Test 7: Test Notification Preferences

```bash
AUTH_TOKEN="your_token"

# Get current preferences
curl http://localhost:3000/api/rate-limit/notifications/preferences \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Update preferences
curl -X POST http://localhost:3000/api/rate-limit/notifications/preferences \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [
      {
        "type": "email",
        "config": {
          "recipients": "admin@example.com"
        },
        "enabled": true,
        "minSeverity": "HIGH"
      },
      {
        "type": "slack",
        "config": {
          "webhookUrl": "https://hooks.slack.com/services/YOUR_WEBHOOK",
          "channel": "#alerts"
        },
        "enabled": true,
        "minSeverity": "MEDIUM"
      }
    ],
    "breachThreshold": 1,
    "quietHours": {
      "start": 22,
      "end": 8
    },
    "enabled": true
  }'

# Get breach history
curl http://localhost:3000/api/rate-limit/breach-history?limit=50 \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

---

## 2. Automated Testing with Node.js

### Create a test file: `tests/manual/rateLimitingManualTest.ts`

```typescript
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
let authToken = 'your_auth_token';

async function test1_GenerateAPIKey() {
  console.log('\n=== Test 1: Generate API Key ===');

  try {
    const response = await axios.post(
      `${BASE_URL}/api/rate-limit/api-keys/generate`,
      {
        name: 'Test Key',
        tier: 'BASIC',
        endpoints: ['/*']
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log('✅ API Key Generated:', response.data.data.apiKey.substring(0, 20) + '...');
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
    throw error;
  }
}

async function test2_MakeRequestsWithKey(apiKey: string) {
  console.log('\n=== Test 2: Make Requests with API Key ===');

  try {
    // Make 5 successful requests
    for (let i = 1; i <= 5; i++) {
      const response = await axios.get(`${BASE_URL}/api/documents`, {
        headers: { 'X-API-Key': apiKey }
      });

      const remaining = response.headers['x-ratelimit-remaining'];
      const limit = response.headers['x-ratelimit-limit'];

      console.log(`Request ${i}: ${remaining}/${limit} remaining`);
    }

    console.log('✅ All requests successful');
  } catch (error: any) {
    console.error('❌ Failed:', error.message);
    throw error;
  }
}

async function test3_HitRateLimit(apiKey: string) {
  console.log('\n=== Test 3: Hit Rate Limit ===');

  try {
    let requestCount = 0;
    let rateLimited = false;

    // Make requests until rate limited
    for (let i = 0; i < 600; i++) {
      try {
        const response = await axios.get(`${BASE_URL}/api/documents`, {
          headers: { 'X-API-Key': apiKey }
        });

        requestCount++;

        if (requestCount % 100 === 0) {
          console.log(`Request ${requestCount}: OK`);
        }
      } catch (error: any) {
        if (error.response?.status === 429) {
          console.log(`✅ Rate limited after ${requestCount} requests`);
          console.log('Response:', error.response.data);
          rateLimited = true;
          break;
        }

        throw error;
      }
    }

    if (!rateLimited) {
      console.log('⚠️  Did not hit rate limit after 600 requests');
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

async function test4_AnalyticsAndBreachHistory() {
  console.log('\n=== Test 4: Analytics and Breach History ===');

  try {
    // Get analytics
    const analyticsResponse = await axios.get(
      `${BASE_URL}/api/rate-limit/analytics`,
      {
        headers: { 'X-API-Key': 'any_valid_key' }
      }
    );

    console.log('✅ Analytics retrieved');
    console.log('Total requests:', analyticsResponse.data.data.totalRequests);
    console.log('Blocked requests:', analyticsResponse.data.data.blockedRequests);

    // Get breach history
    const breachResponse = await axios.get(
      `${BASE_URL}/api/rate-limit/breach-history`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log('✅ Breach history retrieved');
    console.log('Number of breaches:', breachResponse.data.count);
  } catch (error: any) {
    console.error('❌ Failed:', error.response?.data || error.message);
  }
}

async function runAllTests() {
  try {
    const keyData = await test1_GenerateAPIKey();
    await test2_MakeRequestsWithKey(keyData.apiKey);
    await test3_HitRateLimit(keyData.apiKey);
    await test4_AnalyticsAndBreachHistory();

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test suite failed');
    process.exit(1);
  }
}

runAllTests();
```

**Run tests:**
```bash
ts-node tests/manual/rateLimitingManualTest.ts
```

---

## 3. Load Testing with Artillery

### Create `artillery-config.yml`:

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up"
    - duration: 60
      arrivalRate: 200
      name: "Stress test"
  variables:
    apiKey: "your_api_key"

scenarios:
  - name: "Rate Limit Stress Test"
    flow:
      - get:
          url: "/api/documents"
          headers:
            X-API-Key: "{{ apiKey }}"
          expect:
            - statusCode: [200, 429]
```

**Run load test:**
```bash
npm install -g artillery

artillery run artillery-config.yml --html report.html
```

---

## 4. DDOS Pattern Detection Test

Create `tests/manual/ddosTest.ts`:

```typescript
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testDDOSDetection() {
  console.log('Testing DDOS Pattern Detection...');

  const api = axios.create({
    baseURL: BASE_URL,
    validateStatus: () => true // Don't throw on any status
  });

  let blocked = false;
  let blockedAt = 0;

  // Simulate DDOS: make 150 requests in rapid succession
  for (let i = 0; i < 150; i++) {
    const response = await api.get('/api/documents', {
      headers: { 'X-API-Key': 'test-key' }
    });

    if (response.status === 403 && response.data.message?.includes('Suspicious activity')) {
      console.log(`✅ DDOS detected at request ${i}`);
      console.log('Response:', response.data);
      blocked = true;
      blockedAt = i;
      break;
    }

    if (i % 20 === 0) {
      console.log(`Request ${i}: ${response.status}`);
    }
  }

  if (!blocked) {
    console.log('⚠️  DDOS pattern not detected within 150 requests');
  }

  return blocked;
}

testDDOSDetection();
```

---

## 5. Integration Test with Jest

### Run built-in tests:

```bash
# Run all tests
npm test

# Run only rate limiting tests
npm test -- rateLimiting.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## 6. Database Inspection

### Check Redis data:

```bash
# Connect to Redis
redis-cli

# See all keys
KEYS *

# Check API key data
GET api_key:your-key-id

# Check blocked IPs
KEYS ip_block:*

# Monitor in real-time
MONITOR
```

---

## 7. Testing Checklist

### Basic Functionality
- [ ] API key generation works
- [ ] API key validation works
- [ ] API key can be revoked
- [ ] Rate limit is enforced
- [ ] Rate limit headers are returned
- [ ] 429 status code returned when limited

### Advanced Features
- [ ] Different tiers have different limits
- [ ] Tier-based burst capacity works
- [ ] IP blocking works
- [ ] IP whitelisting works
- [ ] DDOS pattern detected
- [ ] Abuse patterns recorded
- [ ] Auto-blocking on threshold

### Notifications
- [ ] Breach notifications sent
- [ ] Multiple channels work
- [ ] Quiet hours respected
- [ ] Severity filtering works
- [ ] Breach history recorded

### Edge Cases
- [ ] Expired keys rejected
- [ ] Inactive keys rejected
- [ ] Wrong endpoint restrictions enforced
- [ ] Concurrent requests handled
- [ ] Redis failures handled gracefully

---

## 8. Debugging

### Enable verbose logging:

```bash
DEBUG=* npm start
```

### Check Redis logs:

```bash
docker logs -f redis_container_name
```

### Monitor API:

```bash
# Watch rate limit metrics
curl -s http://localhost:3000/api/rate-limit/analytics \
  -H "X-API-Key: test-key" | jq
```

---

## 9. Performance Benchmarking

Create `tests/manual/benchmarkTest.ts`:

```typescript
import axios from 'axios';

async function benchmark(name: string, fn: () => Promise<any>, iterations = 100) {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await fn();
  }

  const duration = performance.now() - start;
  const avg = duration / iterations;

  console.log(`${name}: ${avg.toFixed(2)}ms avg (${duration.toFixed(0)}ms total)`);
}

async function runBenchmarks() {
  const apiKey = 'test-api-key';

  await benchmark('API Request with Rate Limit Check', async () => {
    await axios.get('http://localhost:3000/api/documents', {
      headers: { 'X-API-Key': apiKey }
    });
  }, 50);

  await benchmark('Rate Limit Header Parse', async () => {
    const response = await axios.get('http://localhost:3000/api/documents', {
      headers: { 'X-API-Key': apiKey }
    });

    const _ = {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
      reset: response.headers['x-ratelimit-reset']
    };
  }, 50);
}

runBenchmarks();
```

---

## 10. Environment Variables for Testing

Create `.env.test`:

```bash
NODE_ENV=test
REDIS_URL=redis://localhost:6379

# Email (use test SMTP)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=test
SMTP_PASS=test

# Slack (optional - use webhook URL)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_TEST_HOOK

# Admin
ADMIN_EMAIL=test@example.com

# Rate Limiting
RATE_LIMIT_ENABLED=true

# IP blocking
BLOCKED_IPS=""
```

---

## Tips & Tricks

✅ **Do:**
- Clear Redis between major test suites
- Use different API keys for different tests
- Log response headers for debugging
- Monitor Redis memory usage
- Test with production-like data volumes

❌ **Don't:**
- Use production API keys/tokens in tests
- Leave rate limit windows open during testing
- Test against production database
- Share test data between tests
- Ignore edge cases

---

**Ready to test? Start with manual cURL tests, then move to automated testing!**
