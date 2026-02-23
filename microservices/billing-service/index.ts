import express from 'express';
import { billingClient } from '../../databases/clients';
import EventBus from '../../databases/event-patterns/EventBus';
import MessageBroker from '../../databases/event-patterns/MessageBroker';
import { createBillCreatedEvent } from '../../databases/event-patterns/events';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';
import '../../databases/event-patterns/handlers';

const app = express();
const PORT = process.env.BILLING_SERVICE_PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'billing-service', timestamp: new Date().toISOString() });
});

app.post('/bills', async (req, res, next) => {
  try {
    const bill = await billingClient.bill.create({ data: req.body });
    const event = createBillCreatedEvent(bill.id, req.body.userId, req.body.amount);
    
    EventBus.publish(event);
    await MessageBroker.publish(event);
    
    sendSuccess(res, bill, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/bills/:id', async (req, res, next) => {
  try {
    const bill = await billingClient.bill.findUnique({ where: { id: req.params.id } });
    if (!bill) return sendError(res, 'BILL_NOT_FOUND', 'Bill not found', 404);
    sendSuccess(res, bill);
  } catch (error) {
    next(error);
  }
});

app.get('/bills/user/:userId', async (req, res, next) => {
  try {
    const bills = await billingClient.bill.findMany({ where: { userId: req.params.userId } });
    sendSuccess(res, bills);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Billing service running on port ${PORT}`));
