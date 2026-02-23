import express from 'express';
import { webhookClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess } from '../shared/utils/response';

const app = express();
const PORT = process.env.WEBHOOK_SERVICE_PORT || 3008;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'webhook-service' });
});

app.post('/webhooks', async (req, res, next) => {
  try {
    const webhook = await webhookClient.webhook.create({ data: req.body });
    sendSuccess(res, webhook, 201);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Webhook service on port ${PORT}`));
