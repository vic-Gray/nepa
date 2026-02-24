import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

export const notificationResolvers = {
  Query: {},

  Subscription: {
    notificationReceived: {
      subscribe: (_: any, { userId }: { userId: string }) => {
        return pubsub.asyncIterator([`NOTIFICATION_RECEIVED_${userId}`]);
      },
      resolve: (payload: any) => payload.notification,
    },

    systemEvent: {
      subscribe: (_: any, { event }: { event: string }) => {
        return pubsub.asyncIterator([`SYSTEM_EVENT_${event}`]);
      },
      resolve: (payload: any) => payload.systemEvent,
    },
  },
};
