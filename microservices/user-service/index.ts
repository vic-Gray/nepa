import express from 'express';
import { userClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess, sendError } from '../shared/utils/response';

const app = express();
const PORT = process.env.USER_SERVICE_PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'user-service', timestamp: new Date().toISOString() });
});

app.post('/users', async (req, res, next) => {
  try {
    const user = await userClient.user.create({ data: req.body });
    sendSuccess(res, user, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userClient.user.findUnique({ where: { id: req.params.id } });
    if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

app.put('/users/:id', async (req, res, next) => {
  try {
    const user = await userClient.user.update({ where: { id: req.params.id }, data: req.body });
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`User service running on port ${PORT}`));
