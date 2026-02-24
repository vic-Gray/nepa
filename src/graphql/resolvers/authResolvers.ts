import { AuthenticationController } from '../../controllers/AuthenticationController';
import { authenticate } from '../../middleware/authentication';
import { PubSub } from 'graphql-subscriptions';

const authController = new AuthenticationController();
const pubsub = new PubSub();

export const authResolvers = {
  Query: {},

  Mutation: {
    register: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const result = await authController.register({
          body: input,
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Registration failed');
      }
    },

    login: async (_: any, { email, password }: { email: string; password: string }, context: any) => {
      try {
        const result = await authController.login({
          body: { email, password },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Login failed');
      }
    },

    loginWithWallet: async (_: any, { walletAddress }: { walletAddress: string }, context: any) => {
      try {
        const result = await authController.loginWithWallet({
          body: { walletAddress },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Wallet login failed');
      }
    },

    refreshToken: async (_: any, { refreshToken }: { refreshToken: string }, context: any) => {
      try {
        const result = await authController.refreshToken({
          body: { refreshToken },
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Token refresh failed');
      }
    },

    logout: async (_: any, __: any, context: any) => {
      try {
        if (!context.user) {
          throw new Error('Not authenticated');
        }

        await authController.logout({
          user: context.user,
        } as any, {
          status: (code: number) => ({
            json: (data: any) => data
          })
        } as any);

        return true;
      } catch (error: any) {
        throw new Error(error.message || 'Logout failed');
      }
    },
  },
};
