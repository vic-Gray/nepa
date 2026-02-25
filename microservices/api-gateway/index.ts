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

/** Forward API version header to backend for versioned routing */
function forwardApiVersion(req: express.Request, res: express.Response, next: express.NextFunction) {
  const version = req.headers['x-api-version'] || req.query.version;
  if (version) {
    req.headers['x-api-version'] = Array.isArray(version) ? version[0] : (version as string);
  }
  next();
}

app.get('/health', async (req, res) => {
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

app.use('/api', forwardApiVersion);
app.use('/api/users', async (req, res, next) => {
  try {
    const response = await axios({ method: req.method, url: `${services.user}${req.path}`, data: req.body });
    res.json(response.data);
  } catch (error: any) {
    next(error);
  }
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
