import { PrismaClient as PaymentPrismaClient } from '../../node_modules/.prisma/payment-client';

const paymentClient = new PaymentPrismaClient({
  datasources: {
    db: {
      url: process.env.PAYMENT_SERVICE_DATABASE_URL,
    },
  },
});

export default paymentClient;
