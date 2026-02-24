import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';

const prisma = new PrismaClient();

// DataLoaders for performance optimization
const reportLoader = new DataLoader(async (ids: string[]) => {
  const reports = await prisma.report.findMany({
    where: { id: { in: ids } },
    include: { user: true },
  });
  
  return ids.map(id => reports.find(report => report.id === id));
});

export const reportResolvers = {
  Query: {
    report: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const report = await reportLoader.load(id);
      if (!report) {
        throw new Error('Report not found');
      }

      // Check if user owns the report or is admin
      if (report.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      return report;
    },

    reports: async (_: any, { first = 10, after }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = () => {
        // Admin can see all reports, others see only their own
        if (context.user.role === 'ADMIN') {
          return {};
        }
        return { userId: context.user.id };
      };

      const [reports, totalCount] = await Promise.all([
        prisma.report.findMany({
          where: buildWhereClause(),
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.report.count({ where: buildWhereClause() }),
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

    myReports: async (_: any, { first = 10, after }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [reports, totalCount] = await Promise.all([
        prisma.report.findMany({
          where: { userId: context.user.id },
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.report.count({ where: { userId: context.user.id } }),
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
  },

  Mutation: {
    generateReport: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        const report = await prisma.report.create({
          data: {
            userId: context.user.id,
            name: input.name,
            type: input.type,
            description: input.description,
            parameters: input.parameters,
            status: 'PENDING',
          },
          include: { user: true },
        });

        // Simulate report generation (in real implementation, generate actual report)
        setTimeout(async () => {
          try {
            await prisma.report.update({
              where: { id: report.id },
              data: {
                status: 'COMPLETED',
                generatedAt: new Date(),
              },
            });
          } catch (error) {
            console.error('Report generation error:', error);
          }
        }, 3000); // Simulate 3-second generation time

        return report;
      } catch (error: any) {
        throw new Error(error.message || 'Report generation failed');
      }
    },

    deleteReport: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const existingReport = await prisma.report.findUnique({
        where: { id },
      });

      if (!existingReport) {
        throw new Error('Report not found');
      }

      // Check if user owns the report or is admin
      if (existingReport.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      try {
        await prisma.report.delete({
          where: { id },
        });

        // Clear cache
        reportLoader.clear(id);

        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Report deletion failed');
      }
    },
  },

  Report: {
    user: async (parent: any) => {
      const { userLoader } = require('./userResolvers');
      return await userLoader.load(parent.userId);
    },
  },
};
