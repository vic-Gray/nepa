import { PrismaClient as UtilityPrismaClient } from '../../node_modules/.prisma/utility-client';

const utilityClient = new UtilityPrismaClient({
  datasources: {
    db: {
      url: process.env.UTILITY_SERVICE_DATABASE_URL,
    },
  },
});

export default utilityClient;
