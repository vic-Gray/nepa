import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { paymentClient } from '../../databases/clients';
import { createLogger } from '../shared/utils/logger';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import { OpenTelemetrySetup } from '../../observability/tracing/OpenTelemetrySetup';
import EventBus from '../../databases/event-patterns/EventBus';
import { createPaymentSuccessEvent, createPaymentFailedEvent } from '../../databases/event-patterns/events';

const SERVICE_NAME = 'payment-service';
const PORT = process.env.PAYMENT_SERVICE_PORT || 3002;
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
    await paymentClient.$queryRaw`SELECT 1`;
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

app.post('/payments', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.create({
      data: req.body,
    });
    
    EventBus.publish(createPaymentSuccessEvent(
      payment.id,
      payment.billId,
      payment.userId,
      payment.amount
    ));
    
    sendSuccess(res, payment, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/payments/:id', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.findUnique({
      where: { id: req.params.id },
    });
    
    if (!payment) {
      return sendError(res, 'PAYMENT_NOT_FOUND', 'Payment not found', 404);
    }
    
    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
});

app.get('/payments/user/:userId', async (req, res, next) => {
  try {
    const payments = await paymentClient.payment.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
    });
    
    sendSuccess(res, payments);
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
  await paymentClient.$disconnect();
  await tracing.shutdown();
  process.exit(0);
});
