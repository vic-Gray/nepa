import express from 'express';
import { analyticsClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess } from '../shared/utils/response';

const app = express();
const PORT = process.env.ANALYTICS_SERVICE_PORT || 3007;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'analytics-service' });
});

app.get('/analytics/dashboard', async (req, res, next) => {
  try {
    const data = await analyticsClient.analyticsEvent.findMany({ take: 100 });
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Analytics service on port ${PORT}`));
