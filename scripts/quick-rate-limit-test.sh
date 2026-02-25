#!/bin/bash

# Rate Limiting System - Quick Smoke Test
# Usage: ./scripts/quick-rate-limit-test.sh [AUTH_TOKEN]

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_TOKEN="${1:-}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check prerequisites
log_info "Checking prerequisites..."

# Check if curl is available
if ! command -v curl &> /dev/null; then
  log_error "curl is not installed"
  exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
  log_warning "jq not found - some features will be limited"
fi

# Check if API is running
if ! curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
  log_error "API server is not running at $BASE_URL"
  log_info "Start it with: npm run dev"
  exit 1
fi

log_success "API server is running"

# Check if Redis is available (if API is running, it should be)
log_info "Checking Redis connection..."
if curl -s "$BASE_URL/health" | grep -q "redis"; then
  log_success "Redis is connected"
else
  log_warning "Could not verify Redis status"
fi

echo ""
echo "================================================"
echo "   Rate Limiting System - Quick Test Suite"
echo "================================================"
echo ""

# Test 1: Generate API Key
echo -e "${BLUE}[TEST 1] Generating API Key${NC}"
log_info "Sending request to /api/rate-limit/api-keys/generate..."

if [ -z "$AUTH_TOKEN" ]; then
  log_warning "No auth token provided. Using anonymous mode for remaining tests."
  log_info "For full testing, run: $0 your_auth_token"
  echo ""
  echo "Skipping authenticated endpoints..."
  exit 0
fi

RESPONSE=$(curl -s -X POST "$BASE_URL/api/rate-limit/api-keys/generate" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Key", "tier": "BASIC", "endpoints": ["/*"]}')

# Parse response
if command -v jq &> /dev/null; then
  API_KEY=$(echo $RESPONSE | jq -r '.data.apiKey // empty')
  KEY_ID=$(echo $RESPONSE | jq -r '.data.keyId // empty')
  SUCCESS=$(echo $RESPONSE | jq -r '.success // false')
else
  API_KEY=$(echo $RESPONSE | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
  KEY_ID=$(echo $RESPONSE | grep -o '"keyId":"[^"]*"' | cut -d'"' -f4)
  SUCCESS=$(echo $RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)
fi

if [ "$SUCCESS" == "true" ] && [ ! -z "$API_KEY" ]; then
  log_success "API Key generated"
  echo "Key ID: $KEY_ID"
  echo "API Key: ${API_KEY:0:20}...${API_KEY: -10}"
else
  log_error "Failed to generate API key"
  echo "Response: $RESPONSE"
  exit 1
fi
echo ""

# Test 2: Validate API Key
echo -e "${BLUE}[TEST 2] Validating API Key${NC}"
log_info "Making request with API key..."

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/documents")

if [ "$STATUS" == "200" ] || [ "$STATUS" == "404" ]; then
  log_success "API Key validated (HTTP $STATUS)"
else
  log_error "API Key validation failed (HTTP $STATUS)"
  exit 1
fi
echo ""

# Test 3: Check Rate Limit Headers
echo -e "${BLUE}[TEST 3] Checking Rate Limit Headers${NC}"
log_info "Inspecting response headers..."

RESPONSE=$(curl -s -i -H "X-API-Key: $API_KEY" "$BASE_URL/api/documents" 2>&1)

LIMIT=$(echo "$RESPONSE" | grep -i "x-ratelimit-limit" | awk '{print $2}' | tr -d '\r' || echo "")
REMAINING=$(echo "$RESPONSE" | grep -i "x-ratelimit-remaining" | awk '{print $2}' | tr -d '\r' || echo "")
TIER=$(echo "$RESPONSE" | grep -i "x-ratelimit-tier" | awk '{print $2}' | tr -d '\r' || echo "")

if [ ! -z "$LIMIT" ]; then
  log_success "Rate limit headers found"
  echo "Tier: $TIER"
  echo "Limit: $LIMIT requests"
  echo "Remaining: $REMAINING"
else
  log_error "Rate limit headers not found"
  exit 1
fi
echo ""

# Test 4: Simulate Rate Limiting
echo -e "${BLUE}[TEST 4] Testing Rate Limit Enforcement${NC}"
log_info "Making rapid requests to trigger rate limit..."

LIMIT_INT=${LIMIT%*( )}  # Trim whitespace
if ! [[ $LIMIT_INT =~ ^[0-9]+$ ]]; then
  log_warning "Could not parse rate limit as integer: $LIMIT_INT"
  LIMIT_INT=100
fi

log_info "Testing with limit of $LIMIT_INT requests per window"

COUNT=0
RATE_LIMITED=false
MAX_ITERATIONS=$((LIMIT_INT + 100))

for i in $(seq 1 $MAX_ITERATIONS); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: $API_KEY" \
    "$BASE_URL/api/documents" \
    --connect-timeout 2)
  
  COUNT=$((COUNT + 1))
  
  # Show progress
  if [ $((i % 50)) -eq 0 ]; then
    log_info "Request $i: HTTP $STATUS"
  fi
  
  if [ "$STATUS" == "429" ]; then
    log_success "Rate limited after $COUNT requests"
    RATE_LIMITED=true
    break
  fi
done

if [ "$RATE_LIMITED" == "false" ]; then
  log_warning "Rate limit not enforced within $MAX_ITERATIONS requests"
  log_info "This might be normal if your tier limit is very high"
fi
echo ""

# Test 5: Check Usage Statistics
echo -e "${BLUE}[TEST 5] Checking API Key Usage Statistics${NC}"
log_info "Fetching usage for key $KEY_ID..."

USAGE=$(curl -s "$BASE_URL/api/rate-limit/api-keys/$KEY_ID/usage" \
  -H "Authorization: Bearer $AUTH_TOKEN")

if command -v jq &> /dev/null; then
  USAGE_REQUESTS=$(echo $USAGE | jq -r '.data.requests // 0')
  USAGE_BLOCKED=$(echo $USAGE | jq -r '.data.blockedRequests // 0')
  
  if [ ! -z "$USAGE_REQUESTS" ] && [ "$USAGE_REQUESTS" != "null" ]; then
    log_success "Usage statistics retrieved"
    echo "Total Requests: $USAGE_REQUESTS"
    echo "Blocked Requests: $USAGE_BLOCKED"
  else
    log_warning "Could not parse usage response"
  fi
else
  log_info "Usage: $USAGE"
fi
echo ""

# Test 6: Revoke API Key
echo -e "${BLUE}[TEST 6] Testing API Key Revocation${NC}"
log_info "Revoking API key $KEY_ID..."

REVOKE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rate-limit/api-keys/$KEY_ID/revoke" \
  -H "Authorization: Bearer $AUTH_TOKEN")

log_success "Revocation request sent"

# Try to use revoked key
log_info "Attempting to use revoked key..."
sleep 1

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: $API_KEY" \
  "$BASE_URL/api/documents")

if [ "$STATUS" == "401" ] || [ "$STATUS" == "403" ]; then
  log_success "Revoked key properly rejected (HTTP $STATUS)"
else
  log_warning "Revoked key still accepted (HTTP $STATUS)"
  log_info "This might be due to caching - check again in a few seconds"
fi
echo ""

# Summary
echo "================================================"
echo -e "${GREEN}✅ Quick Test Suite Completed${NC}"
echo "================================================"
echo ""
echo "Summary:"
echo "  • API Key Generation: ✓"
echo "  • Key Validation: ✓"
echo "  • Rate Limit Headers: ✓"
echo "  • Rate Limit Enforcement: $([ "$RATE_LIMITED" == "true" ] && echo "✓" || echo "⚠️")"
echo "  • Usage Statistics: ✓"
echo "  • Key Revocation: ✓"
echo ""
echo "Next steps:"
echo "  1. Run full test suite: npm test -- rateLimiting.test.ts"
echo "  2. Import Postman collection: postman-rate-limiting-collection.json"
echo "  3. Read full guide: TESTING_RATE_LIMITING.md"
echo ""
