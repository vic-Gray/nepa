import express from 'express';
import { paymentClient } from '../../databases/clients';
import EventBus from '../../databases/event-patterns/EventBus';
import MessageBroker from '../../databases/event-patterns/MessageBroker';
import { createPaymentSuccessEvent, createPaymentFailedEvent } from '../../databases/event-patterns/events';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import '../../databases/event-patterns/handlers';

const app = express();
const PORT = process.env.PAYMENT_SERVICE_PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'payment-service', timestamp: new Date().toISOString() });
});

app.post('/payments', async (req, res, next) => {
  try {
    const payment = await paymentClient.payment.create({ data: req.body });
    const event = createPaymentSuccessEvent(payment.id, req.body.billId, req.body.userId, req.body.amount);
    
    // Publish to both in-memory and message broker
    EventBus.publish(event);
    await MessageBroker.publish(event);
    
    sendSuccess(res, payment, 201);
  } catch (error) {
    const failEvent = createPaymentFailedEvent(req.body.paymentId, req.body.billId, req.body.userId, error.message);
    EventBus.publish(failEvent);
    await MessageBroker.publish(failEvent);
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
