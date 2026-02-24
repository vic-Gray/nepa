import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';
import { PubSub } from 'graphql-subscriptions';

const prisma = new PrismaClient();
const pubsub = new PubSub();

// DataLoaders for performance optimization
const billLoader = new DataLoader(async (ids: string[]) => {
  const bills = await prisma.bill.findMany({
    where: { id: { in: ids } },
    include: { user: true, utility: true, payments: true },
  });
  
  return ids.map(id => bills.find(bill => bill.id === id));
});

const utilityLoader = new DataLoader(async (ids: string[]) => {
  const utilities = await prisma.utility.findMany({
    where: { id: { in: ids } },
  });
  
  return ids.map(id => utilities.find(utility => utility.id === id));
});

export const billResolvers = {
  Query: {
    bill: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const bill = await billLoader.load(id);
      if (!bill) {
        throw new Error('Bill not found');
      }

      // Check if user owns the bill or is admin
      if (bill.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      return bill;
    },

    bills: async (_: any, { first = 10, after, where }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = {};
        
        // Non-admin users can only see their own bills
        if (context.user.role !== 'ADMIN') {
          clause.userId = context.user.id;
        }
        
        if (where?.id) clause.id = where.id;
        if (where?.userId && context.user.role === 'ADMIN') clause.userId = where.userId;
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
          include: { user: true, utility: true, payments: true },
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

    myBills: async (_: any, { first = 10, after, where }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = { userId: context.user.id };
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
          include: { user: true, utility: true, payments: true },
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
  },

  Mutation: {
    createBill: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        const bill = await prisma.bill.create({
          data: {
            amount: input.amount,
            utilityId: input.utilityId,
            dueDate: new Date(input.dueDate),
            lateFee: input.lateFee || 0,
            discount: input.discount || 0,
            userId: context.user.id,
          },
          include: { user: true, utility: true },
        });

        // Publish subscription event
        pubsub.publish('BILL_CREATED', {
          billCreated: bill,
          userId: context.user.id,
        });

        return bill;
      } catch (error: any) {
        throw new Error(error.message || 'Bill creation failed');
      }
    },

    updateBill: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const existingBill = await prisma.bill.findUnique({
        where: { id },
      });

      if (!existingBill) {
        throw new Error('Bill not found');
      }

      // Check if user owns the bill or is admin
      if (existingBill.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      try {
        const updateData: any = {};
        if (input.amount !== undefined) updateData.amount = input.amount;
        if (input.dueDate !== undefined) updateData.dueDate = new Date(input.dueDate);
        if (input.status !== undefined) updateData.status = input.status;
        if (input.lateFee !== undefined) updateData.lateFee = input.lateFee;
        if (input.discount !== undefined) updateData.discount = input.discount;

        const bill = await prisma.bill.update({
          where: { id },
          data: updateData,
          include: { user: true, utility: true },
        });

        // Clear cache
        billLoader.clear(id);

        // Publish subscription event
        pubsub.publish('BILL_UPDATED', {
          billUpdated: bill,
          userId: existingBill.userId,
        });

        return bill;
      } catch (error: any) {
        throw new Error(error.message || 'Bill update failed');
      }
    },

    deleteBill: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const existingBill = await prisma.bill.findUnique({
        where: { id },
      });

      if (!existingBill) {
        throw new Error('Bill not found');
      }

      // Check if user owns the bill or is admin
      if (existingBill.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      try {
        await prisma.bill.delete({
          where: { id },
        });

        // Clear cache
        billLoader.clear(id);

        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Bill deletion failed');
      }
    },
  },

  Subscription: {
    billCreated: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.asyncIterator([`BILL_CREATED_${userId}`]);
      },
      resolve: (payload: any) => payload.billCreated,
    },

    billUpdated: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.asyncIterator([`BILL_UPDATED_${userId}`]);
      },
      resolve: (payload: any) => payload.billUpdated,
    },
  },

  Bill: {
    user: async (parent: any) => {
      const { userLoader } = require('./userResolvers');
      return await userLoader.load(parent.userId);
    },

    utility: async (parent: any) => {
      return await utilityLoader.load(parent.utilityId);
    },

    payments: async (parent: any, { first = 10, after }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [payments, totalCount] = await Promise.all([
        prisma.payment.findMany({
          where: { billId: parent.id },
          skip,
          take,
          include: { user: true, bill: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.payment.count({ where: { billId: parent.id } }),
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
  },
};
