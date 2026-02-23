import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { userClient } from '../../databases/clients';
import { createLogger } from '../shared/utils/logger';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import { OpenTelemetrySetup } from '../../observability/tracing/OpenTelemetrySetup';
import { MetricsCollector } from '../../observability/metrics/MetricsCollector';

const SERVICE_NAME = 'user-service';
const PORT = process.env.USER_SERVICE_PORT || 3001;
const logger = createLogger(SERVICE_NAME);

// Initialize tracing
const tracing = new OpenTelemetrySetup(SERVICE_NAME);
tracing.start();

// Initialize metrics
const metrics = new MetricsCollector(SERVICE_NAME);

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware(SERVICE_NAME));

// Health check
app.get('/health', async (req, res) => {
  try {
    await userClient.$queryRaw`SELECT 1`;
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

// Get user by ID
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userClient.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
    });
    
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }
    
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

// Get user by email
app.get('/users/email/:email', async (req, res, next) => {
  try {
    const user = await userClient.user.findUnique({
      where: { email: req.params.email },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }
    
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

// Create user
app.post('/users', async (req, res, next) => {
  try {
    const user = await userClient.user.create({
      data: req.body,
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    
    sendSuccess(res, user, 201);
  } catch (error) {
    next(error);
  }
});

// Update user
app.put('/users/:id', async (req, res, next) => {
  try {
    const user = await userClient.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

// Delete user
app.delete('/users/:id', async (req, res, next) => {
  try {
    await userClient.user.delete({
      where: { id: req.params.id },
    });
    
    sendSuccess(res, { deleted: true });
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
  await userClient.$disconnect();
  await tracing.shutdown();
  process.exit(0);
});
