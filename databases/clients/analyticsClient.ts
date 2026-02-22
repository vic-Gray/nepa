import { PrismaClient as AnalyticsPrismaClient } from '../../node_modules/.prisma/analytics-client';

const analyticsClient = new AnalyticsPrismaClient({
  datasources: {
    db: {
      url: process.env.ANALYTICS_SERVICE_DATABASE_URL,
    },
  },
});

export default analyticsClient;
