import express from 'express';
import { paymentClient } from '../../databases/clients';
import EventBus from '../../databases/event-patterns/EventBus';
import { createPaymentSuccessEvent } from '../../databases/event-patterns/events';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'payment-service', timestamp: new Date().toISOString() });
});

app.post('/payments', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.create({ data: req.body });
    EventBus.publish(createPaymentSuccessEvent(payment.id, req.body.billId, req.body.userId, req.body.amount));
    sendSuccess(res, payment, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/payments/:id', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return sendError(res, 'PAYMENT_NOT_FOUND', 'Payment not found', 404);
    sendSuccess(res, payment);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Payment service running on port ${PORT}`));
