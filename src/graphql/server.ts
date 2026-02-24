import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createServer } from 'http';
import express from 'express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { graphqlUploadExpress } from 'graphql-upload/graphqlUploadExpress.js';

import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { authenticate } from '../middleware/authentication';
import { logger } from '../middleware/logger';

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export interface MyContext {
  user?: any;
  req: express.Request;
  res: express.Response;
}

export class GraphQLServer {
  private httpServer: any;
  private wsServer: WebSocketServer;
  private serverCleanup: any;
  private apolloServer: ApolloServer<MyContext>;

  constructor(app: express.Application) {
    this.httpServer = createServer(app);
    this.setupWebSocketServer();
    this.setupApolloServer(app);
  }

  private setupWebSocketServer() {
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql',
    });

    this.serverCleanup = useServer(
      {
        schema,
        context: async (ctx) => {
          // For WebSocket connections, we need to handle authentication differently
          // This is a simplified version - in production, you'd want to handle
          // authentication through connection parameters or headers
          return {
            req: ctx.extra.request,
            res: ctx.extra.response,
          };
        },
      },
      this.wsServer
    );
  }

  private setupApolloServer(app: express.Application) {
    this.apolloServer = new ApolloServer<MyContext>({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await this.serverCleanup.dispose();
              },
            };
          },
        },
      ],
      introspection: process.env.NODE_ENV !== 'production',
      csrfPrevention: true,
      cache: 'bounded',
    });

    // Set up GraphQL endpoint with file upload support
    app.use(
      '/graphql',
      graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      express.json(),
      expressMiddleware(this.apolloServer, {
        context: async ({ req, res }): Promise<MyContext> => {
          try {
            // Authenticate user for HTTP requests
            const user = await authenticate(req, res);
            return { user, req, res };
          } catch (error) {
            // For public queries (like login, register), we don't require authentication
            const publicOperations = ['login', 'register', 'IntrospectionQuery'];
            const operationName = req.body.operationName;
            
            if (publicOperations.includes(operationName)) {
              return { req, res };
            }
            
            throw error;
          }
        },
      })
    );
  }

  getHttpServer() {
    return this.httpServer;
  }

  async start() {
    await this.apolloServer.start();
  }

  async stop() {
    await this.apolloServer.stop();
  }
}
