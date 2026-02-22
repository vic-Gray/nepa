import { PrismaClient as UserPrismaClient } from '../../node_modules/.prisma/user-client';

const userClient = new UserPrismaClient({
  datasources: {
    db: {
      url: process.env.USER_SERVICE_DATABASE_URL,
    },
  },
});

export default userClient;
