import { PrismaClient as BillingPrismaClient } from '../../node_modules/.prisma/billing-client';

const billingClient = new BillingPrismaClient({
  datasources: {
    db: {
      url: process.env.BILLING_SERVICE_DATABASE_URL,
    },
  },
});

export default billingClient;
