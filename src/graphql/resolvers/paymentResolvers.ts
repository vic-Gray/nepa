import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';
import { PubSub } from 'graphql-subscriptions';

const prisma = new PrismaClient();
const pubsub = new PubSub();

// DataLoaders for performance optimization
const paymentLoader = new DataLoader(async (ids: string[]) => {
  const payments = await prisma.payment.findMany({
    where: { id: { in: ids } },
    include: { user: true, bill: true },
  });
  
  return ids.map(id => payments.find(payment => payment.id === id));
});

export const paymentResolvers = {
  Query: {
    payment: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const payment = await paymentLoader.load(id);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Check if user owns the payment or is admin
      if (payment.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      return payment;
    },

    payments: async (_: any, { first = 10, after, where }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = {};
        
        // Non-admin users can only see their own payments
        if (context.user.role !== 'ADMIN') {
          clause.userId = context.user.id;
        }
        
        if (where?.id) clause.id = where.id;
        if (where?.userId && context.user.role === 'ADMIN') clause.userId = where.userId;
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
          include: { user: true, bill: true },
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

    myPayments: async (_: any, { first = 10, after, where }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = { userId: context.user.id };
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
          include: { user: true, bill: true },
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
  },

  Mutation: {
    processPayment: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        // Check if bill exists and user has access
        const bill = await prisma.bill.findUnique({
          where: { id: input.billId },
          include: { user: true },
        });

        if (!bill) {
          throw new Error('Bill not found');
        }

        if (bill.userId !== context.user.id && context.user.role !== 'ADMIN') {
          throw new Error('Access denied');
        }

        // Apply coupon if provided
        let finalAmount = input.amount;
        if (input.couponCode) {
          const coupon = await prisma.coupon.findUnique({
            where: { code: input.couponCode },
          });

          if (coupon && coupon.isActive && new Date() < new Date(coupon.expiryDate)) {
            if (coupon.type === 'PERCENTAGE') {
              finalAmount = finalAmount * (1 - parseFloat(coupon.amount.toString()) / 100);
            } else {
              finalAmount = Math.max(0, finalAmount - parseFloat(coupon.amount.toString()));
            }
          }
        }

        // Create payment record
        const payment = await prisma.payment.create({
          data: {
            amount: finalAmount,
            method: input.method,
            status: 'PENDING',
            billId: input.billId,
            userId: context.user.id,
            transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
          include: { user: true, bill: true },
        });

        // Simulate payment processing (in real implementation, integrate with payment gateway)
        setTimeout(async () => {
          try {
            const updatedPayment = await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'SUCCESS' },
              include: { user: true, bill: true },
            });

            // Update bill status if fully paid
            const totalPaid = await prisma.payment.aggregate({
              where: {
                billId: payment.billId,
                status: 'SUCCESS',
              },
              _sum: { amount: true },
            });

            if (totalPaid._sum.amount && parseFloat(totalPaid._sum.amount.toString()) >= parseFloat(bill.amount.toString())) {
              await prisma.bill.update({
                where: { id: payment.billId },
                data: { status: 'PAID' },
              });
            }

            // Publish subscription events
            pubsub.publish('PAYMENT_PROCESSED', {
              paymentProcessed: updatedPayment,
              userId: context.user.id,
            });

            pubsub.publish('PAYMENT_UPDATED', {
              paymentUpdated: updatedPayment,
              userId: context.user.id,
            });

          } catch (error) {
            console.error('Payment processing error:', error);
          }
        }, 2000); // Simulate 2-second processing time

        return payment;
      } catch (error: any) {
        throw new Error(error.message || 'Payment processing failed');
      }
    },

    validatePayment: async (_: any, { paymentId }: { paymentId: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        const payment = await paymentLoader.load(paymentId);
        if (!payment) {
          throw new Error('Payment not found');
        }

        // Check if user owns the payment or is admin
        if (payment.userId !== context.user.id && context.user.role !== 'ADMIN') {
          throw new Error('Access denied');
        }

        // In real implementation, validate with payment gateway
        const isValid = payment.status === 'SUCCESS';

        if (isValid) {
          return payment;
        } else {
          throw new Error('Payment validation failed');
        }
      } catch (error: any) {
        throw new Error(error.message || 'Payment validation failed');
      }
    },
  },

  Subscription: {
    paymentProcessed: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.asyncIterator([`PAYMENT_PROCESSED_${userId}`]);
      },
      resolve: (payload: any) => payload.paymentProcessed,
    },

    paymentUpdated: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.asyncIterator([`PAYMENT_UPDATED_${userId}`]);
      },
      resolve: (payload: any) => payload.paymentUpdated,
    },
  },

  Payment: {
    user: async (parent: any) => {
      const { userLoader } = require('./userResolvers');
      return await userLoader.load(parent.userId);
    },

    bill: async (parent: any) => {
      const { billLoader } = require('./billResolvers');
      return await billLoader.load(parent.billId);
    },
  },
};
