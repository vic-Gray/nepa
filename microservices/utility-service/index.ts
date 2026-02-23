import express from 'express';
import { utilityClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess } from '../shared/utils/response';

const app = express();
const PORT = process.env.UTILITY_SERVICE_PORT || 3006;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'utility-service' });
});

app.post('/utilities', async (req, res, next) => {
  try {
    const utility = await utilityClient.utilityProvider.create({ data: req.body });
    sendSuccess(res, utility, 201);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Utility service on port ${PORT}`));
