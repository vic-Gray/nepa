import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { analyticsClient } from '../../databases/clients';
import { createLogger } from '../shared/utils/logger';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import { OpenTelemetrySetup } from '../../observability/tracing/OpenTelemetrySetup';

const SERVICE_NAME = 'analytics-service';
const PORT = process.env.ANALYTICS_SERVICE_PORT || 3007;
const logger = createLogger(SERVICE_NAME);

const tracing = new OpenTelemetrySetup(SERVICE_NAME);
tracing.start();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware(SERVICE_NAME));

app.get('/health', async (req, res) => {
  try {
    await analyticsClient.$queryRaw`SELECT 1`;
    sendSuccess(res, {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: SERVICE_NAME,
      version: '1.0.0',
      dependencies: { database: 'UP' },
    });
  } catch (error) {
    sendError(res, 'HEALTH_CHECK_FAILED', 'Service unhealthy', 503);
  }
});

app.get('/analytics/dashboard', async (req, res, next) => {
  try {
    const events = await analyticsClient.analyticsEvent.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' },
    });
    
    sendSuccess(res, { events, totalCount: events.length });
  } catch (error) {
    next(error);
  }
});

app.post('/analytics/events', async (req, res, next) => {
  try {
    const event = await analyticsClient.analyticsEvent.create({
      data: req.body,
    });
    
    sendSuccess(res, event, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/analytics/reports', async (req, res, next) => {
  try {
    const reports = await analyticsClient.report.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    sendSuccess(res, reports);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`${SERVICE_NAME} listening on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await analyticsClient.$disconnect();
  await tracing.shutdown();
  process.exit(0);
});
