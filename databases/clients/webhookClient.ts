import { PrismaClient as WebhookPrismaClient } from '../../node_modules/.prisma/webhook-client';

const webhookClient = new WebhookPrismaClient({
  datasources: {
    db: {
      url: process.env.WEBHOOK_SERVICE_DATABASE_URL,
    },
  },
});

export default webhookClient;
