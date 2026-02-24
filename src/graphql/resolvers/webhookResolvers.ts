import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';

const prisma = new PrismaClient();

// DataLoaders for performance optimization
const webhookLoader = new DataLoader(async (ids: string[]) => {
  const webhooks = await prisma.webhook.findMany({
    where: { id: { in: ids } },
    include: { user: true },
  });
  
  return ids.map(id => webhooks.find(webhook => webhook.id === id));
});

export const webhookResolvers = {
  Query: {
    webhook: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const webhook = await webhookLoader.load(id);
      if (!webhook) {
        throw new Error('Webhook not found');
      }

      // Check if user owns the webhook or is admin
      if (webhook.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      return webhook;
    },

    webhooks: async (_: any, { first = 10, after }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = () => {
        // Admin can see all webhooks, others see only their own
        if (context.user.role === 'ADMIN') {
          return {};
        }
        return { userId: context.user.id };
      };

      const [webhooks, totalCount] = await Promise.all([
        prisma.webhook.findMany({
          where: buildWhereClause(),
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.webhook.count({ where: buildWhereClause() }),
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

    myWebhooks: async (_: any, { first = 10, after }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [webhooks, totalCount] = await Promise.all([
        prisma.webhook.findMany({
          where: { userId: context.user.id },
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.webhook.count({ where: { userId: context.user.id } }),
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

  Mutation: {
    createWebhook: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        const webhook = await prisma.webhook.create({
          data: {
            userId: context.user.id,
            url: input.url,
            events: input.events,
            secret: input.secret,
            isActive: true,
            retryCount: 0,
          },
          include: { user: true },
        });

        return webhook;
      } catch (error: any) {
        throw new Error(error.message || 'Webhook creation failed');
      }
    },

    updateWebhook: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const existingWebhook = await prisma.webhook.findUnique({
        where: { id },
      });

      if (!existingWebhook) {
        throw new Error('Webhook not found');
      }

      // Check if user owns the webhook or is admin
      if (existingWebhook.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      try {
        const updateData: any = {};
        if (input.url !== undefined) updateData.url = input.url;
        if (input.events !== undefined) updateData.events = input.events;
        if (input.secret !== undefined) updateData.secret = input.secret;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;

        const webhook = await prisma.webhook.update({
          where: { id },
          data: updateData,
          include: { user: true },
        });

        // Clear cache
        webhookLoader.clear(id);

        return webhook;
      } catch (error: any) {
        throw new Error(error.message || 'Webhook update failed');
      }
    },

    deleteWebhook: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const existingWebhook = await prisma.webhook.findUnique({
        where: { id },
      });

      if (!existingWebhook) {
        throw new Error('Webhook not found');
      }

      // Check if user owns the webhook or is admin
      if (existingWebhook.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      try {
        await prisma.webhook.delete({
          where: { id },
        });

        // Clear cache
        webhookLoader.clear(id);

        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Webhook deletion failed');
      }
    },
  },

  Webhook: {
    user: async (parent: any) => {
      const { userLoader } = require('./userResolvers');
      return await userLoader.load(parent.userId);
    },
  },
};
