import EventBus, { DomainEvent } from '../EventBus';
import { notificationClient } from '../../clients';

// Handle payment success - send notification
EventBus.subscribe('payment.success', async (event: DomainEvent) => {
  const { userId, amount, billId } = event.payload;
  
  await notificationClient.notification.create({
    data: {
      userId,
      type: 'EMAIL',
      subject: 'Payment Successful',
      content: `Your payment of ${amount} for bill ${billId} was successful.`,
      status: 'SENT',
    },
  });
  
  console.log(`✅ Notification sent for payment ${event.aggregateId}`);
});

// Handle payment failure - send notification
EventBus.subscribe('payment.failed', async (event: DomainEvent) => {
  const { userId, reason, billId } = event.payload;
  
  await notificationClient.notification.create({
    data: {
      userId,
      type: 'EMAIL',
      subject: 'Payment Failed',
      content: `Your payment for bill ${billId} failed: ${reason}`,
      status: 'SENT',
    },
  });
  
  console.log(`✅ Failure notification sent for payment ${event.aggregateId}`);
});

// Handle bill created - send notification
EventBus.subscribe('bill.created', async (event: DomainEvent) => {
  const { userId, amount, billId } = event.payload;
  
  await notificationClient.notification.create({
    data: {
      userId,
      type: 'EMAIL',
      subject: 'New Bill Generated',
      content: `A new bill of ${amount} has been generated.`,
      status: 'SENT',
    },
  });
  
  console.log(`✅ Bill notification sent for ${billId}`);
});

export {};
