import express, { Request, Response, NextFunction } from 'express';
import axios, { AxiosError, AxiosInstance, Method } from 'axios';
import { responseCompression } from '../shared/middleware/responseCompression';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { errorHandler } from '../shared/middleware/errorHandler';

type ServiceMap = Record<string, string>;

interface CacheEntry {
  body: unknown;
  status: number;
  expiresAt: number;
  headers: Record<string, string>;
}

interface GatewayStats {
  totalRequests: number;
  proxiedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  upstreamErrors: number;
  latenciesMs: number[];
}

const app = express();
const PORT = Number(process.env.API_GATEWAY_PORT || 3000);
const REQUEST_TIMEOUT_MS = Number(process.env.GATEWAY_REQUEST_TIMEOUT_MS || 4000);
const CACHE_TTL_MS = Number(process.env.GATEWAY_CACHE_TTL_MS || 10_000);
const MAX_LATENCY_SAMPLES = Number(process.env.GATEWAY_MAX_LATENCY_SAMPLES || 5000);
const MAX_CACHE_SIZE = Number(process.env.GATEWAY_CACHE_MAX_ENTRIES || 1000);
const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.GATEWAY_SLOW_REQUEST_THRESHOLD_MS || 500);

const services: ServiceMap = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  document: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3005',
  utility: process.env.UTILITY_SERVICE_URL || 'http://localhost:3006',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007',
  webhook: process.env.WEBHOOK_SERVICE_URL || 'http://localhost:3008',
};

const httpAgent = new HttpAgent({
  keepAlive: true,
  maxSockets: Number(process.env.GATEWAY_MAX_SOCKETS || 2048),
  maxFreeSockets: Number(process.env.GATEWAY_MAX_FREE_SOCKETS || 256),
  timeout: REQUEST_TIMEOUT_MS,
  keepAliveMsecs: Number(process.env.GATEWAY_KEEP_ALIVE_MS || 5000),
});

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: Number(process.env.GATEWAY_MAX_SOCKETS || 2048),
  maxFreeSockets: Number(process.env.GATEWAY_MAX_FREE_SOCKETS || 256),
  timeout: REQUEST_TIMEOUT_MS,
  keepAliveMsecs: Number(process.env.GATEWAY_KEEP_ALIVE_MS || 5000),
});

const upstreamClient: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  httpAgent,
  httpsAgent,
  validateStatus: () => true,
  transitional: {
    clarifyTimeoutError: true,
  },
});

const responseCache = new Map<string, CacheEntry>();
const stats: GatewayStats = {
  totalRequests: 0,
  proxiedRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  upstreamErrors: 0,
  latenciesMs: [],
};

app.use(express.json({ limit: '1mb' }));
app.use(responseCompression(1024));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  stats.totalRequests += 1;

  res.on('finish', () => {
    const latency = performance.now() - start;
    stats.latenciesMs.push(latency);

    if (stats.latenciesMs.length > MAX_LATENCY_SAMPLES) {
      stats.latenciesMs = stats.latenciesMs.slice(-MAX_LATENCY_SAMPLES);
    }

    if (latency > SLOW_REQUEST_THRESHOLD_MS) {
      console.warn('[gateway] slow request', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        latencyMs: Number(latency.toFixed(2)),
      });
    }
  });

  next();
});

const getCacheKey = (req: Request) => `${req.method}:${req.originalUrl}`;

const trimCache = () => {
  if (responseCache.size <= MAX_CACHE_SIZE) {
    return;
  }

  const oldestKey = responseCache.keys().next().value;
  if (oldestKey) {
    responseCache.delete(oldestKey);
  }
};

const readCached = (req: Request): CacheEntry | null => {
  if (req.method !== 'GET') {
    return null;
  }

  const key = getCacheKey(req);
  const cached = responseCache.get(key);

  if (!cached) {
    stats.cacheMisses += 1;
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    stats.cacheMisses += 1;
    return null;
  }

  stats.cacheHits += 1;
  return cached;
};

const cacheResponse = (req: Request, status: number, body: unknown, headers: Record<string, string>) => {
  if (req.method !== 'GET' || status >= 400) {
    return;
  }

  const key = getCacheKey(req);
  responseCache.set(key, {
    body,
    status,
    headers,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  trimCache();
};

const sanitizeForwardHeaders = (req: Request): Record<string, string> => {
  const forwardedHeaders: Record<string, string> = {
    'x-forwarded-for': req.ip,
    'x-forwarded-proto': req.protocol,
    'x-request-id': (req.headers['x-request-id'] as string) || '',
  };

  const allowedHeaders = ['authorization', 'content-type', 'accept', 'accept-language', 'user-agent'];

  for (const headerName of allowedHeaders) {
    const headerValue = req.headers[headerName];
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      forwardedHeaders[headerName] = headerValue;
    }
  }

  return forwardedHeaders;
};

const collectOutboundHeaders = (headers: Record<string, unknown>): Record<string, string> => {
  const passthrough: Record<string, string> = {};
  const headerWhitelist = ['cache-control', 'content-type', 'etag', 'last-modified'];

  for (const key of headerWhitelist) {
    const value = headers[key];
    if (typeof value === 'string') {
      passthrough[key] = value;
    }
  }

  return passthrough;
};

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const renderPrometheusMetrics = (): string => {
  const avgLatency = stats.latenciesMs.length
    ? stats.latenciesMs.reduce((sum, value) => sum + value, 0) / stats.latenciesMs.length
    : 0;

  const p50 = percentile(stats.latenciesMs, 50);
  const p95 = percentile(stats.latenciesMs, 95);
  const p99 = percentile(stats.latenciesMs, 99);
  const cacheLookups = stats.cacheHits + stats.cacheMisses;
  const cacheHitRatio = cacheLookups > 0 ? stats.cacheHits / cacheLookups : 0;

  return [
    '# HELP gateway_requests_total Total number of requests handled by gateway',
    '# TYPE gateway_requests_total counter',
    `gateway_requests_total ${stats.totalRequests}`,
    '# HELP gateway_proxied_requests_total Total number of proxied upstream requests',
    '# TYPE gateway_proxied_requests_total counter',
    `gateway_proxied_requests_total ${stats.proxiedRequests}`,
    '# HELP gateway_upstream_errors_total Total number of upstream request errors',
    '# TYPE gateway_upstream_errors_total counter',
    `gateway_upstream_errors_total ${stats.upstreamErrors}`,
    '# HELP gateway_cache_hits_total Total number of gateway cache hits',
    '# TYPE gateway_cache_hits_total counter',
    `gateway_cache_hits_total ${stats.cacheHits}`,
    '# HELP gateway_cache_misses_total Total number of gateway cache misses',
    '# TYPE gateway_cache_misses_total counter',
    `gateway_cache_misses_total ${stats.cacheMisses}`,
    '# HELP gateway_cache_hit_ratio Current gateway cache hit ratio',
    '# TYPE gateway_cache_hit_ratio gauge',
    `gateway_cache_hit_ratio ${cacheHitRatio}`,
    '# HELP gateway_cache_entries Current number of items in gateway cache',
    '# TYPE gateway_cache_entries gauge',
    `gateway_cache_entries ${responseCache.size}`,
    '# HELP gateway_latency_average_ms Average gateway request latency in milliseconds',
    '# TYPE gateway_latency_average_ms gauge',
    `gateway_latency_average_ms ${avgLatency.toFixed(4)}`,
    '# HELP gateway_latency_p50_ms P50 gateway request latency in milliseconds',
    '# TYPE gateway_latency_p50_ms gauge',
    `gateway_latency_p50_ms ${p50.toFixed(4)}`,
    '# HELP gateway_latency_p95_ms P95 gateway request latency in milliseconds',
    '# TYPE gateway_latency_p95_ms gauge',
    `gateway_latency_p95_ms ${p95.toFixed(4)}`,
    '# HELP gateway_latency_p99_ms P99 gateway request latency in milliseconds',
    '# TYPE gateway_latency_p99_ms gauge',
    `gateway_latency_p99_ms ${p99.toFixed(4)}`,
  ].join('\n');
};

const proxyToService = (serviceKey: keyof typeof services, upstreamBasePath: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const serviceUrl = services[serviceKey];

    const cached = readCached(req);
    if (cached) {
      Object.entries(cached.headers).forEach(([name, value]) => res.setHeader(name, value));
      res.setHeader('x-cache', 'HIT');
      res.status(cached.status).json(cached.body);
      return;
    }

    try {
      stats.proxiedRequests += 1;
      const method = req.method as Method;
      const targetPath = req.url === '/' ? '' : req.url;
      const targetUrl = `${serviceUrl}${upstreamBasePath}${targetPath}`;

      const upstreamResponse = await upstreamClient.request({
        method,
        url: targetUrl,
        data: req.body,
        headers: sanitizeForwardHeaders(req),
      });

      const passthroughHeaders = collectOutboundHeaders(upstreamResponse.headers as Record<string, unknown>);
      Object.entries(passthroughHeaders).forEach(([name, value]) => res.setHeader(name, value));
      res.setHeader('x-cache', 'MISS');

      if (upstreamResponse.status >= 500) {
        stats.upstreamErrors += 1;
      }

      cacheResponse(req, upstreamResponse.status, upstreamResponse.data, passthroughHeaders);

      res.status(upstreamResponse.status).json(upstreamResponse.data);
    } catch (error) {
      stats.upstreamErrors += 1;
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status || 502;

      next({
        statusCode,
        code: 'UPSTREAM_REQUEST_FAILED',
        message: `Failed to proxy request to ${serviceKey} service`,
        details: {
          service: serviceKey,
          target: services[serviceKey],
          reason: axiosError.message,
        },
      });
    }
  };
};

app.get('/health', async (_req, res) => {
  const health = await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      try {
        const response = await upstreamClient.get(`${url}/health`, { timeout: 1500 });
        return { service: name, status: response.status < 500 ? 'UP' : 'DEGRADED' };
      } catch {
        return { service: name, status: 'DOWN' };
      }
    })
  );

  res.json({ gateway: 'UP', services: health });
});

app.get('/metrics', (_req: Request, res: Response) => {
  const avgLatency = stats.latenciesMs.length
    ? stats.latenciesMs.reduce((sum, value) => sum + value, 0) / stats.latenciesMs.length
    : 0;

  const hitRatio = stats.cacheHits + stats.cacheMisses > 0
    ? (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100
    : 0;

  res.json({
    requests: {
      total: stats.totalRequests,
      proxied: stats.proxiedRequests,
      upstreamErrors: stats.upstreamErrors,
    },
    latencyMs: {
      average: Number(avgLatency.toFixed(2)),
      p50: Number(percentile(stats.latenciesMs, 50).toFixed(2)),
      p95: Number(percentile(stats.latenciesMs, 95).toFixed(2)),
      p99: Number(percentile(stats.latenciesMs, 99).toFixed(2)),
    },
    cache: {
      entries: responseCache.size,
      hitRatio: Number(hitRatio.toFixed(2)),
      ttlMs: CACHE_TTL_MS,
    },
    connections: {
      maxSockets: httpAgent.maxSockets,
      maxFreeSockets: httpAgent.maxFreeSockets,
    },
  });
});

app.get('/metrics/prometheus', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(renderPrometheusMetrics());
});

// CDN integration endpoint for static assets (optional)
app.get('/assets/*', (req: Request, res: Response, next: NextFunction) => {
  const cdnBaseUrl = process.env.CDN_BASE_URL;

  if (!cdnBaseUrl) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
    return;
  }

  const assetPath = req.path.replace('/assets', '');
  const normalizedBase = cdnBaseUrl.endsWith('/') ? cdnBaseUrl.slice(0, -1) : cdnBaseUrl;
  res.redirect(302, `${normalizedBase}${assetPath}`);
});

app.use('/api/users', proxyToService('user', '/users'));
app.use('/api/payments', proxyToService('payment', '/payments'));
app.use('/api/bills', proxyToService('billing', '/bills'));

app.use(errorHandler);

app.listen(PORT, () => console.log(`API Gateway on port ${PORT}`));
