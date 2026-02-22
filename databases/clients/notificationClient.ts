import { PrismaClient as NotificationPrismaClient } from '../../node_modules/.prisma/notification-client';

const notificationClient = new NotificationPrismaClient({
  datasources: {
    db: {
      url: process.env.NOTIFICATION_SERVICE_DATABASE_URL,
    },
  },
});

export default notificationClient;
