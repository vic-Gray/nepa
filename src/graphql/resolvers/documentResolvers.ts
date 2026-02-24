import { PrismaClient } from '@prisma/client';
import DataLoader from 'dataloader';

const prisma = new PrismaClient();

// DataLoaders for performance optimization
const documentLoader = new DataLoader(async (ids: string[]) => {
  const documents = await prisma.document.findMany({
    where: { id: { in: ids } },
    include: { user: true },
  });
  
  return ids.map(id => documents.find(document => document.id === id));
});

export const documentResolvers = {
  Query: {
    document: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const document = await documentLoader.load(id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if user owns the document or is admin or document is public
      if (document.userId !== context.user.id && 
          context.user.role !== 'ADMIN' && 
          !document.isPublic) {
        throw new Error('Access denied');
      }

      return document;
    },

    documents: async (_: any, { first = 10, after }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const buildWhereClause = () => {
        // Admin can see all documents, others see only their own or public documents
        if (context.user.role === 'ADMIN') {
          return {};
        }
        return {
          OR: [
            { userId: context.user.id },
            { isPublic: true },
          ],
        };
      };

      const [documents, totalCount] = await Promise.all([
        prisma.document.findMany({
          where: buildWhereClause(),
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.count({ where: buildWhereClause() }),
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

    myDocuments: async (_: any, { first = 10, after }: any, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const skip = after ? parseInt(Buffer.from(after, 'base64').toString()) : 0;
      const take = Math.min(first, 50);

      const [documents, totalCount] = await Promise.all([
        prisma.document.findMany({
          where: { userId: context.user.id },
          skip,
          take,
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.document.count({ where: { userId: context.user.id } }),
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
  },

  Mutation: {
    uploadDocument: async (_: any, { file, isPublic = false }: { file: any; isPublic: boolean }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      try {
        // In a real implementation, handle file upload to S3/IPFS
        // For now, simulate file upload
        const { createReadStream, filename, mimetype, encoding } = await file;
        
        const stream = createReadStream();
        const chunks: any[] = [];
        
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        const size = buffer.length;
        
        // Simulate file path (in real implementation, this would be S3/IPFS URL)
        const path = `uploads/${context.user.id}/${Date.now()}_${filename}`;

        const document = await prisma.document.create({
          data: {
            userId: context.user.id,
            filename: path,
            originalName: filename,
            mimeType: mimetype,
            size,
            path,
            isPublic,
          },
          include: { user: true },
        });

        return document;
      } catch (error: any) {
        throw new Error(error.message || 'Document upload failed');
      }
    },

    deleteDocument: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }

      const existingDocument = await prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        throw new Error('Document not found');
      }

      // Check if user owns the document or is admin
      if (existingDocument.userId !== context.user.id && context.user.role !== 'ADMIN') {
        throw new Error('Access denied');
      }

      try {
        // In real implementation, delete from S3/IPFS
        await prisma.document.delete({
          where: { id },
        });

        // Clear cache
        documentLoader.clear(id);

        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Document deletion failed');
      }
    },
  },

  Document: {
    user: async (parent: any) => {
      const { userLoader } = require('./userResolvers');
      return await userLoader.load(parent.userId);
    },
  },
};
