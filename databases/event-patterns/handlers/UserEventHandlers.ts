// Event handlers for User service events
import EventBus, { DomainEvent } from '../EventBus';
import notificationClient from '../../clients/notificationClient';
import analyticsClient from '../../clients/analyticsClient';

// When a user is created, create notification preferences
EventBus.subscribe('user.created', async (event: DomainEvent) => {
  const { userId, email } = event.payload;
  
  console.log(`📧 Creating notification preferences for user: ${userId}`);
  
  await notificationClient.notificationPreference.create({
    data: {
      userId,
      email: true,
      sms: false,
      push: false,
    },
  });
  
  console.log(`✅ Notification preferences created for user: ${userId}`);
});

// Track user creation in analytics
EventBus.subscribe('user.created', async (event: DomainEvent) => {
  const { userId } = event.payload;
  
  console.log(`📊 Recording user creation in analytics: ${userId}`);
  
  await analyticsClient.report.create({
    data: {
      title: 'User Registration',
      type: 'USER_GROWTH',
      data: {
        userId,
        timestamp: event.timestamp,
        source: 'user-service',
      },
      createdBy: userId,
    },
  });
  
  console.log(`✅ User creation recorded in analytics: ${userId}`);
});
