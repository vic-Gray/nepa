// Event handlers for Bill service events
import EventBus, { DomainEvent } from '../EventBus';
import notificationClient from '../../clients/notificationClient';
import analyticsClient from '../../clients/analyticsClient';

// Send notification when bill is created
EventBus.subscribe('bill.created', async (event: DomainEvent) => {
  const { billId, userId, amount } = event.payload;
  
  console.log(`📧 Sending bill created notification to user: ${userId}`);
  
  await notificationClient.notificationLog.create({
    data: {
      userId,
      type: 'BILL_CREATED',
      status: 'SENT',
      message: `A new bill of $${amount} has been created. Bill ID: ${billId}`,
    },
  });
  
  console.log(`✅ Bill created notification sent to user: ${userId}`);
});

// Record bill creation in analytics
EventBus.subscribe('bill.created', async (event: DomainEvent) => {
  const { billId, userId, amount } = event.payload;
  
  console.log(`📊 Recording bill creation in analytics: ${billId}`);
  
  await analyticsClient.report.create({
    data: {
      title: 'Bill Created',
      type: 'BILLS',
      data: {
        billId,
        userId,
        amount: amount.toString(),
        timestamp: event.timestamp,
      },
      createdBy: userId,
    },
  });
  
  console.log(`✅ Bill creation recorded in analytics: ${billId}`);
});

// Send notification when bill is paid
EventBus.subscribe('bill.paid', async (event: DomainEvent) => {
  const { billId, userId, paymentId } = event.payload;
  
  console.log(`📧 Sending bill paid notification to user: ${userId}`);
  
  await notificationClient.notificationLog.create({
    data: {
      userId,
      type: 'BILL_PAID',
      status: 'SENT',
      message: `Your bill has been paid successfully. Bill ID: ${billId}, Payment ID: ${paymentId}`,
    },
  });
  
  console.log(`✅ Bill paid notification sent to user: ${userId}`);
});
