import { UserController } from '../../controllers/UserController';
import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';
import { PubSub } from 'graphql-subscriptions';

const prisma = new PrismaClient();
const userController = new UserController();
const pubsub = new PubSub();

// DataLoaders for performance optimization
const userLoader = new DataLoader(async (ids: string[]) => {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    include: {
      profiles: true,
      notificationPreference: true,
    },
  });
  
  return ids.map(id => users.find(user => user.id === id));
});

const billsByUserLoader = new DataLoader(async (userIds: string[]) => {
  const bills = await prisma.bill.findMany({
    where: { userId: { in: userIds } },
    include: { utility: true },
  });
  
  return userIds.map(userId => bills.filter(bill => bill.userId === userId));
});

const paymentsByUserLoader = new DataLoader(async (userIds: string[]) => {
  const payments = await prisma.payment.findMany({
    where: { userId: { in: userIds } },
    include: { bill: true },
  });
  
  return userIds.map(userId => payments.filter(payment => payment.userId === userId));
});

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }
      
      const user = await userLoader.load(context.user.id);
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    },

    user: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }
      
      const user = await userLoader.load(id);
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    },

    users: async (_: any, { first = 10, after, where }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50); // Limit to 50 per request

      const buildWhereClause = (where: any) => {
        const clause: any = {};
        if (where?.id) clause.id = where.id;
        if (where?.email) clause.email = { contains: where.email, mode: 'insensitive' };
        if (where?.username) clause.username = { contains: where.username, mode: 'insensitive' };
        if (where?.name) clause.name = { contains: where.name, mode: 'insensitive' };
        if (where?.role) clause.role = where.role;
        if (where?.status) clause.status = where.status;
        if (where?.isEmailVerified !== undefined) clause.isEmailVerified = where.isEmailVerified;
        if (where?.isPhoneVerified !== undefined) clause.isPhoneVerified = where.isPhoneVerified;
        return clause;
      };

      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where: buildWhereClause(where),
          skip,
          take,
          include: {
            profiles: true,
            notificationPreference: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where: buildWhereClause(where) }),
      ]);

      const edges = users.map((user, index) => ({
        node: user,
        cursor: Buffer.from((skip + index + 1).toString()).toString('base64'),
      }));

      const hasNextPage = skip + users.length < totalCount;
      const hasPreviousPage = skip > 0;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    },
  },

  Mutation: {
    updateProfile: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        const result = await userController.updateProfile({
          user: context.user,
          body: input,
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        // Clear cache for this user
        userLoader.clear(context.user.id);

        // Publish subscription event
        pubsub.publish('USER_UPDATED', {
          userUpdated: result,
          userId: context.user.id,
        });

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Profile update failed');
      }
    },

    changePassword: async (_: any, { currentPassword, newPassword }: { currentPassword: string; newPassword: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        await userController.changePassword({
          user: context.user,
          body: { currentPassword, newPassword },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Password change failed');
      }
    },

    updateUserRole: async (_: any, { userId, role }: { userId: string; role: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Not authorized');
      }

      try {
        const result = await userController.updateUserRole({
          params: { id: userId },
          body: { role },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        // Clear cache for updated user
        userLoader.clear(userId);

        // Publish subscription event
        pubsub.publish('USER_UPDATED', {
          userUpdated: result,
          userId,
        });

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Role update failed');
      }
    },

    updateUserStatus: async (_: any, { userId, status }: { userId: string; status: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Not authorized');
      }

      try {
        const result = await userController.updateUserRole({
          params: { id: userId },
          body: { status },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        // Clear cache for updated user
        userLoader.clear(userId);

        // Publish subscription event
        pubsub.publish('USER_UPDATED', {
          userUpdated: result,
          userId,
        });

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Status update failed');
      }
    },
  },

  Subscription: {
    userUpdated: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.asyncIterator([`USER_UPDATED_${userId}`]);
      },
      resolve: (payload: any) => payload.userUpdated,
    },
  },

  User: {
    bills: async (parent: any, { first = 10, after, where }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = { userId: parent.id };
        if (where?.id) clause.id = where.id;
        if (where?.utilityId) clause.utilityId = where.utilityId;
        if (where?.status) clause.status = where.status;
        if (where?.dueDate) {
          if (where.dueDate.gte) clause.dueDate = { ...clause.dueDate, gte: new Date(where.dueDate.gte) };
          if (where.dueDate.lte) clause.dueDate = { ...clause.dueDate, lte: new Date(where.dueDate.lte) };
        }
        if (where?.amount) {
          if (where.amount.gte) clause.amount = { ...clause.amount, gte: where.amount.gte };
          if (where.amount.lte) clause.amount = { ...clause.amount, lte: where.amount.lte };
        }
        return clause;
      };

      const [bills, totalCount] = await Promise.all([
        prisma.bill.findMany({
          where: buildWhereClause(where),
          skip,
          take,
          include: { utility: true, user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.bill.count({ where: buildWhereClause(where) }),
      ]);

      const edges = bills.map((bill, index) => ({
        node: bill,
        cursor: Buffer.from((skip + index + 1).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + bills.length < totalCount,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    },

    payments: async (parent: any, { first = 10, after, where }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = { userId: parent.id };
        if (where?.id) clause.id = where.id;
        if (where?.billId) clause.billId = where.billId;
        if (where?.status) clause.status = where.status;
        if (where?.method) clause.method = where.method;
        if (where?.createdAt) {
          if (where.createdAt.gte) clause.createdAt = { ...clause.createdAt, gte: new Date(where.createdAt.gte) };
          if (where.createdAt.lte) clause.createdAt = { ...clause.createdAt, lte: new Date(where.createdAt.lte) };
        }
        return clause;
      };

      const [payments, totalCount] = await Promise.all([
        prisma.payment.findMany({
          where: buildWhereClause(where),
          skip,
          take,
          include: { bill: true, user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.payment.count({ where: buildWhereClause(where) }),
      ]);

      const edges = payments.map((payment, index) => ({
        node: payment,
        cursor: Buffer.from((skip + index + 1).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + payments.length < totalCount,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    },

    documents: async (parent: any, { first = 10, after }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [documents, totalCount] = await Promise.all([
        prisma.document.findMany({
          where: { userId: parent.id },
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.count({ where: { userId: parent.id } }),
      ]);

      const edges = documents.map((document, index) => ({
        node: document,
        cursor: Buffer.from((skip + index + 1).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + documents.length < totalCount,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    },

    reports: async (parent: any, { first = 10, after }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [reports, totalCount] = await Promise.all([
        prisma.report.findMany({
          where: { userId: parent.id },
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.report.count({ where: { userId: parent.id } }),
      ]);

      const edges = reports.map((report, index) => ({
        node: report,
        cursor: Buffer.from((skip + index + 1).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + reports.length < totalCount,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    },

    webhooks: async (parent: any, { first = 10, after }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [webhooks, totalCount] = await Promise.all([
        prisma.webhook.findMany({
          where: { userId: parent.id },
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.webhook.count({ where: { userId: parent.id } }),
      ]);

      const edges = webhooks.map((webhook, index) => ({
        node: webhook,
        cursor: Buffer.from((skip + index + 1).toString()).toString('base64'),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: skip + webhooks.length < totalCount,
          hasPreviousPage: skip > 0,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };
    },
  },

  UserProfile: {
    user: async (parent: any) => {
      return await userLoader.load(parent.userId);
    },
  },

  NotificationPreference: {
    user: async (parent: any) => {
      return await userLoader.load(parent.userId);
    },
  },
};
