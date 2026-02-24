import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const utilityResolvers = {
  Query: {
    utility: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const utility = await prisma.utility.findUnique({
        where: { id },
        include: { bills: true },
      });

      if (!utility) {
        throw new Error('Utility not found');
      }

      return utility;
    },

    utilities: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const utilities = await prisma.utility.findMany({
        include: { 
          bills: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { name: 'asc' },
      });

      return utilities;
    },
  },

  Utility: {
    bills: async (parent: any, { first = 10, after, where }: any) => {
      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = (where: any) => {
        const clause: any = { utilityId: parent.id };
        if (where?.id) clause.id = where.id;
        if (where?.userId) clause.userId = where.userId;
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
          include: { user: true, utility: true },
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
};
