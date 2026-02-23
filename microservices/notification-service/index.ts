import express from 'express';
import { notificationClient } from '../../databases/clients';
import { errorHandler } from '../shared/middleware/errorHandler';
import { sendSuccess } from '../shared/utils/response';

const app = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3004;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'notification-service' });
});

app.post('/notifications', async (req, res, next) => {
  try {
    const notification = await notificationClient.notification.create({ data: req.body });
    sendSuccess(res, notification, 201);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`Notification service on port ${PORT}`));
