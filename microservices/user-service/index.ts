import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { responseCompression } from '../shared/middleware/responseCompression';
import { userClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { requestIdMiddleware } from '../shared/middleware/requestId';
import { sendSuccess, sendError } from '../shared/utils/response';

const app = express();
const PORT = Number(process.env.USER_SERVICE_PORT || 3001);

app.use(helmet());
app.use(cors());
app.use(responseCompression(1024));
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware('user-service'));

app.get('/health', async (_req, res) => {
  try {
    await userClient.$queryRaw`SELECT 1`;
    res.json({ status: 'UP', service: 'user-service', timestamp: new Date().toISOString() });
  } catch {
    sendError(res, 'HEALTH_CHECK_FAILED', 'Service unhealthy', 503);
  }
});

app.post('/users', async (req, res, next) => {
  try {
    const user = await userClient.user.create({
      data: req.body,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        walletAddress: true,
        createdAt: true,
      },
    });

    sendSuccess(res, user, 201);
  } catch (error) {
    next(error);
  }
});

app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await userClient.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        walletAddress: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

app.put('/users/:id', async (req, res, next) => {
  try {
    const user = await userClient.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        walletAddress: true,
        updatedAt: true,
      },
    });

    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`User service running on port ${PORT}`));
