# Microservices Architecture

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Routes requests to services |
| User Service | 3001 | User management & auth |
| Payment Service | 3002 | Payment processing |
| Billing Service | 3003 | Bill management |
| Notification Service | 3004 | Notifications |
| Document Service | 3005 | Document storage |
| Utility Service | 3006 | Utility providers |
| Analytics Service | 3007 | Analytics & reporting |
| Webhook Service | 3008 | Webhook management |

## Quick Start

```bash
# Start all services locally
npm run microservices:start

# Start with Docker
npm run microservices:docker-build
npm run microservices:docker-up

# Stop Docker services
npm run microservices:docker-down
```

## API Gateway Routes

- `POST /api/users` → User Service
- `GET /api/users/:id` → User Service
- `POST /api/payments` → Payment Service
- `GET /api/payments/:id` → Payment Service
- `POST /api/bills` → Billing Service
- `GET /api/bills/:id` → Billing Service

## Health Checks

Each service exposes `/health` endpoint:
- `http://localhost:3001/health` - User Service
- `http://localhost:3002/health` - Payment Service
- etc.

Gateway aggregates all health checks at `http://localhost:3000/health`
Gateway performance metrics:
- JSON metrics: `http://localhost:3000/metrics`
- Prometheus metrics: `http://localhost:3000/metrics/prometheus`

## Environment Variables

```env
USER_SERVICE_PORT=3001
PAYMENT_SERVICE_PORT=3002
BILLING_SERVICE_PORT=3003
NOTIFICATION_SERVICE_PORT=3004
DOCUMENT_SERVICE_PORT=3005
UTILITY_SERVICE_PORT=3006
ANALYTICS_SERVICE_PORT=3007
WEBHOOK_SERVICE_PORT=3008
API_GATEWAY_PORT=3000

# Gateway performance tuning
GATEWAY_REQUEST_TIMEOUT_MS=4000
GATEWAY_CACHE_TTL_MS=10000
GATEWAY_CACHE_MAX_ENTRIES=1000
GATEWAY_MAX_SOCKETS=2048
GATEWAY_MAX_FREE_SOCKETS=256
GATEWAY_KEEP_ALIVE_MS=5000
GATEWAY_SLOW_REQUEST_THRESHOLD_MS=500

# Optional CDN redirect for /assets/*
CDN_BASE_URL=https://cdn.example.com

# Prisma connection pooling defaults
DB_CONNECTION_LIMIT=20
DB_POOL_TIMEOUT_SECONDS=15
DB_CONNECT_TIMEOUT_SECONDS=10
DB_USE_PGBOUNCER=false
```

## Migration Benefits

✅ Independent deployment per service
✅ Isolated database per service
✅ Technology diversity support
✅ Fault isolation
✅ Independent scaling
✅ Team autonomy
