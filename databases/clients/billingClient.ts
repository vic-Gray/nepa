import { PrismaClient as BillingPrismaClient } from '../../node_modules/.prisma/billing-client';
import { buildOptimizedDatabaseUrl } from './urlOptimizer';

const billingClient = new BillingPrismaClient({
  datasources: {
    db: {
      url: buildOptimizedDatabaseUrl(process.env.BILLING_SERVICE_DATABASE_URL),
    },
  },
});

export default billingClient;
