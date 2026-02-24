import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { responseCompression } from '../shared/middleware/responseCompression';
import { paymentClient } from '../../databases/clients';
import EventBus from '../../databases/event-patterns/EventBus';
import MessageBroker from '../../databases/event-patterns/MessageBroker';
import { createPaymentSuccessEvent, createPaymentFailedEvent } from '../../databases/event-patterns/events';
import { errorHandler } from '../shared/middleware/errorHandler';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { sendSuccess, sendError } from '../shared/utils/response';
import '../../databases/event-patterns/handlers';

const app = express();
const PORT = Number(process.env.PAYMENT_SERVICE_PORT || 3002);

app.use(helmet());
app.use(cors());
app.use(responseCompression(1024));
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware('payment-service'));

app.get('/health', async (_req, res) => {
  try {
    await paymentClient.$queryRaw`SELECT 1`;
    res.json({ status: 'UP', service: 'payment-service', timestamp: new Date().toISOString() });
  } catch {
    sendError(res, 'HEALTH_CHECK_FAILED', 'Service unhealthy', 503);
  }
});

app.post('/payments', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.create({
      data: req.body,
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        transactionId: true,
        billId: true,
        userId: true,
        createdAt: true,
      },
    });

    const event = createPaymentSuccessEvent(payment.id, payment.billId, payment.userId, Number(payment.amount));

    EventBus.publish(event);
    await MessageBroker.publish(event);

    sendSuccess(res, payment, 201);
  } catch (error: any) {
    const failEvent = createPaymentFailedEvent(req.body.paymentId, req.body.billId, req.body.userId, error?.message || 'unknown error');
    EventBus.publish(failEvent);
    await MessageBroker.publish(failEvent);
    next(error);
  }
});

app.get('/payments/:id', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        transactionId: true,
        billId: true,
        userId: true,
        createdAt: true,
      },
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
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const payments = await paymentClient.payment.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        transactionId: true,
        billId: true,
        userId: true,
        createdAt: true,
      },
    });

    sendSuccess(res, payments, 200, { limit, offset });
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Payment service running on port ${PORT}`));
