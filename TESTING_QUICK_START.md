# Rate Limiting System - Testing Quick Start

## 5-Minute Quick Test

### Step 1: Start Redis
```bash
docker run -d -p 6379:6379 redis:latest
```

### Step 2: Start Your API Server
```bash
npm run dev
```

### Step 3: Get an Auth Token
```bash
# Use your login endpoint or create a test token
AUTH_TOKEN="your_jwt_token_here"
```

### Step 4: Generate an API Key
```bash
curl -X POST http://localhost:3000/api/rate-limit/api-keys/generate \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "tier": "BASIC"}'
```

Save the `apiKey` from response.

### Step 5: Make Test Requests
```bash
API_KEY="from_step_4"

# Request should succeed
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/documents

# Check rate limit headers
curl -i -H "X-API-Key: $API_KEY" http://localhost:3000/api/documents | grep X-RateLimit
```

## Testing Strategies by Level

### 🟢 Level 1: Basic Integration Testing (10 mins)
Perfect for: Quick verification after deployment

**What to test:**
- API key generation ✓
- API key validation ✓
- Rate limit headers returned ✓
- 429 response when limit exceeded ✓

**Commands:**
```bash
# See QUICK_TEST.sh below
bash scripts/quick-rate-limit-test.sh
```

---

### 🟡 Level 2: Unit Testing (30 mins)
Perfect for: Continuous Integration, feature verification

**What to test:**
- All service methods individually
- Edge cases and error conditions
- Data persistence in Redis

**Run:**
```bash
npm test -- rateLimiting.test.ts

# With coverage
npm test -- rateLimiting.test.ts --coverage
```

**Expected output:**
```
PASS tests/unit/rateLimiting.test.ts
  APIKeyManagementService
    generateAPIKey
      ✓ should generate a valid API key
      ✓ should set correct tier-based limits
    validateAPIKey
      ✓ should validate a correctly formatted valid key
      ✓ should reject invalid API keys
    ...
```

---

### 🟠 Level 3: Manual Testing with Postman (30 mins)
Perfect for: Testing all endpoints with GUI, exploring API

**Steps:**
1. Import `postman-rate-limiting-collection.json` into Postman
2. Set variables: `base_url`, `auth_token`, `api_key`
3. Run requests in sequence
4. Inspect responses and headers

**File location:**
```bash
postman-rate-limiting-collection.json
```

---

### 🔴 Level 4: Load & Stress Testing (1-2 hours)
Perfect for: Performance validation, production readiness

**Install Artillery:**
```bash
npm install -g artillery
```

**Run load test:**
```bash
artillery run artillery-config.yml --html report.html
open report.html
```

**Monitor:**
- Response times
- Error rates
- Rate limiting accuracy
- Database performance

---

## Testing Files Reference

| File | Purpose | Runtime |
|------|---------|---------|
| `tests/unit/rateLimiting.test.ts` | Unit + integration tests | 2-5 mins |
| `TESTING_RATE_LIMITING.md` | Complete testing guide | Reference |
| `postman-rate-limiting-collection.json` | API endpoint tests | Manual |
| `QUICK_TEST.sh` (create below) | Quick smoke tests | 1 min |

---

## Create Quick Smoke Test Script

Create `scripts/quick-rate-limit-test.sh`:

```bash
#!/bin/bash

set -e

BASE_URL="http://localhost:3000"
AUTH_TOKEN="${1:-your_token_here}"

echo "🧪 Running Rate Limiting Quick Tests..."
echo ""

# Test 1: Generate API Key
echo "1️⃣  Generating API Key..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/rate-limit/api-keys/generate" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Key", "tier": "BASIC"}')

API_KEY=$(echo $RESPONSE | jq -r '.data.apiKey')
KEY_ID=$(echo $RESPONSE | jq -r '.data.keyId')

if [ "$API_KEY" == "null" ]; then
  echo "❌ Failed to generate API key"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "✅ API Key generated: ${API_KEY:0:20}..."
echo ""

# Test 2: Make requests with API Key
echo "2️⃣  Testing API Key validation..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/documents")

if [ "$STATUS" == "200" ]; then
  echo "✅ API Key validated (200 OK)"
else
  echo "❌ API Key validation failed (Status: $STATUS)"
  exit 1
fi
echo ""

# Test 3: Check rate limit headers
echo "3️⃣  Checking rate limit headers..."
HEADERS=$(curl -s -i -H "X-API-Key: $API_KEY" "$BASE_URL/api/documents" | grep -i "x-ratelimit")

if echo "$HEADERS" | grep -q "x-ratelimit-limit"; then
  echo "✅ Rate limit headers present"
  echo "$HEADERS"
else
  echo "❌ Rate limit headers missing"
  exit 1
fi
echo ""

# Test 4: Hit rate limit
echo "4️⃣  Testing rate limit enforcement..."
LIMIT=$(curl -s -i -H "X-API-Key: $API_KEY" "$BASE_URL/api/documents" | grep "x-ratelimit-limit" | awk '{print $2}' | tr -d '\r')

# Make requests until we hit limit (or max 600 for BASIC tier)
COUNT=0
while [ $COUNT -lt $((LIMIT + 50)) ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/documents")
  
  COUNT=$((COUNT + 1))
  
  if [ "$STATUS" == "429" ]; then
    echo "✅ Rate limit enforced after $COUNT requests (Expected: ~$(($LIMIT)))"
    break
  fi
done

if [ "$STATUS" != "429" ]; then
  echo "⚠️  Rate limit not enforced within $COUNT requests"
fi
echo ""

# Test 5: Revoke key
echo "5️⃣  Testing API key revocation..."
curl -s -X POST "$BASE_URL/api/rate-limit/api-keys/$KEY_ID/revoke" \
  -H "Authorization: Bearer $AUTH_TOKEN" > /dev/null

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/documents")

if [ "$STATUS" == "401" ] || [ "$STATUS" == "403" ]; then
  echo "✅ Revoked key rejected ($STATUS)"
else
  echo "❌ Revoked key still accepted ($STATUS)"
  exit 1
fi
echo ""

echo "✅ All quick tests passed!"
```

**Run it:**
```bash
chmod +x scripts/quick-rate-limit-test.sh
./scripts/quick-rate-limit-test.sh your_auth_token
```

---

## Testing Checklist

### Functionality
- [ ] API key generation works
- [ ] API key validation works
- [ ] Rate limit enforced (429 status)
- [ ] Rate limit headers returned
- [ ] API key revocation works
- [ ] Different tiers have correct limits

### Features
- [ ] Tiered limits working (FREE < BASIC < PREMIUM < ENTERPRISE)
- [ ] Burst capacity respected
- [ ] Endpoint restrictions enforced
- [ ] API key expiration works
- [ ] IP blocking works
- [ ] White listing works

### Notifications
- [ ] Email notifications sent
- [ ] Slack notifications sent
- [ ] Breach history recorded
- [ ] Quiet hours respected

### Edge Cases
- [ ] Expired keys rejected
- [ ] Inactive keys rejected
- [ ] Wrong endpoint restrictions enforced
- [ ] Concurrent requests handled
- [ ] Redis connection failures handled

---

## Debugging Tips

### Check Redis Data
```bash
redis-cli
KEYS *                           # See all keys
GET api_key:xxx                  # Check API key data
KEYS ip_block:*                  # Check blocked IPs
MONITOR                          # Watch all operations
```

### Check Logs
```bash
# Watch logs
tail -f logs/app.log

# With timestamp
tail -f logs/app.log | tee >(cut -d' ' -f 1-2 | uniq)

# Filter by rate limiting
grep -i "rate\|limit\|breach" logs/app.log
```

### Test Notifications
```bash
# Check email logs (if using local SMTP)
docker logs mailhog_container

# Test Slack webhook
curl -X POST https://hooks.slack.com/services/YOUR_WEBHOOK \
  -H 'Content-Type: application/json' \
  -d '{"text": "Test message"}'
```

---

## Performance Benchmarks (Expected)

| Operation | Latency | Notes |
|-----------|---------|-------|
| API Key Validation | 2-5ms | Redis lookup |
| Rate Limit Check | 3-8ms | Redis incr + ttl |
| Tier Lookup | 1-3ms | Cached in memory |
| Notification Send | <100ms | Async, non-blocking |
| IP Block Check | 2-5ms | Redis lookup |

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test Rate Limiting

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:latest
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm test -- rateLimiting.test.ts
      - run: ./scripts/quick-rate-limit-test.sh
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Redis connection refused" | Start Redis: `docker run -d -p 6379:6379 redis:latest` |
| Tests fail with "ECONNREFUSED" | Check API server is running on correct port |
| Rate limit not enforcing | Verify Redis is persisting data, check rate limit config |
| Notifications not sending | Verify SMTP/webhook config, check logs |
| API key validation fails | Verify key format, check key hasn't expired |

---

## Next Steps

1. **Run the quick test** (5 mins)
   ```bash
   ./scripts/quick-rate-limit-test.sh
   ```

2. **Run unit tests** (30 mins)
   ```bash
   npm test -- rateLimiting.test.ts
   ```

3. **Import Postman collection** (visual testing)
   - Import `postman-rate-limiting-collection.json`
   - Test all endpoints manually

4. **Read full guide** (reference)
   - Review `TESTING_RATE_LIMITING.md`

---

**Happy Testing! 🎉**

Questions? Check the `/docs` folder or the comprehensive guides included in this implementation.
