import express from 'express';
import axios from 'axios';
import { errorHandler } from '../shared/middleware/errorHandler';

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 3000;

app.use(express.json());

const services = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
  document: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3005',
  utility: process.env.UTILITY_SERVICE_URL || 'http://localhost:3006',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007',
  webhook: process.env.WEBHOOK_SERVICE_URL || 'http://localhost:3008',
};

app.get('/health', async (req, res) => {
  const health = await Promise.all(
    Object.entries(services).map(async ([name, url]) => {
      try {
        await axios.get(`${url}/health`, { timeout: 2000 });
        return { service: name, status: 'UP' };
      } catch {
        return { service: name, status: 'DOWN' };
      }
    })
  );
  res.json({ gateway: 'UP', services: health });
});

app.use('/api/users', async (req, res, next) => {
  try {
    const response = await axios({ method: req.method, url: `${services.user}${req.path}`, data: req.body });
    res.json(response.data);
  } catch (error: any) {
    next(error);
  }
});

app.use('/api/payments', async (req, res, next) => {
  try {
    const response = await axios({ method: req.method, url: `${services.payment}${req.path}`, data: req.body });
    res.json(response.data);
  } catch (error: any) {
    next(error);
  }
});

app.use('/api/bills', async (req, res, next) => {
  try {
    const response = await axios({ method: req.method, url: `${services.billing}${req.path}`, data: req.body });
    res.json(response.data);
  } catch (error: any) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`API Gateway on port ${PORT}`));
