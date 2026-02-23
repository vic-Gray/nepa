import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { notificationClient } from '../../databases/clients';
import { createLogger } from '../shared/utils/logger';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import { OpenTelemetrySetup } from '../../observability/tracing/OpenTelemetrySetup';
import EventBus from '../../databases/event-patterns/EventBus';

const SERVICE_NAME = 'notification-service';
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3004;
const logger = createLogger(SERVICE_NAME);

const tracing = new OpenTelemetrySetup(SERVICE_NAME);
tracing.start();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware(SERVICE_NAME));

// Subscribe to events
EventBus.subscribe('payment.success', async (event) => {
  logger.info('Received payment.success event', event);
  // Send notification logic here
});

EventBus.subscribe('user.created', async (event) => {
  logger.info('Received user.created event', event);
  // Send welcome email logic here
});

app.get('/health', async (req, res) => {
  try {
    await notificationClient.$queryRaw`SELECT 1`;
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

app.post('/notifications', async (req, res, next) => {
  try {
    const notification = await notificationClient.notification.create({
      data: req.body,
    });
    
    sendSuccess(res, notification, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/notifications/user/:userId', async (req, res, next) => {
  try {
    const notifications = await notificationClient.notification.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    
    sendSuccess(res, notifications);
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
  await notificationClient.$disconnect();
  await tracing.shutdown();
  process.exit(0);
});
