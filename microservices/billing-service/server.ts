import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { billingClient } from '../../databases/clients';
import { createLogger } from '../shared/utils/logger';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import { OpenTelemetrySetup } from '../../observability/tracing/OpenTelemetrySetup';
import EventBus from '../../databases/event-patterns/EventBus';

const SERVICE_NAME = 'billing-service';
const PORT = process.env.BILLING_SERVICE_PORT || 3003;
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
    await billingClient.$queryRaw`SELECT 1`;
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

app.post('/bills', async (req, res, next) => {
  try {
    const bill = await billingClient.bill.create({
      data: req.body,
    });
    
    sendSuccess(res, bill, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/bills/:id', async (req, res, next) => {
  try {
    const bill = await billingClient.bill.findUnique({
      where: { id: req.params.id },
    });
    
    if (!bill) {
      return sendError(res, 'BILL_NOT_FOUND', 'Bill not found', 404);
    }
    
    sendSuccess(res, bill);
  } catch (error) {
    next(error);
  }
});

app.get('/bills/user/:userId', async (req, res, next) => {
  try {
    const bills = await billingClient.bill.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    
    sendSuccess(res, bills);
  } catch (error) {
    next(error);
  }
});

app.put('/bills/:id', async (req, res, next) => {
  try {
    const bill = await billingClient.bill.update({
      where: { id: req.params.id },
      data: req.body,
    });
    
    sendSuccess(res, bill);
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
  await billingClient.$disconnect();
  await tracing.shutdown();
  process.exit(0);
});
