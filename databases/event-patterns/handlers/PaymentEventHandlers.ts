// Event handlers for Payment service events
import EventBus, { DomainEvent } from '../EventBus';
import billingClient from '../../clients/billingClient';
import notificationClient from '../../clients/notificationClient';
import analyticsClient from '../../clients/analyticsClient';
import { createBillPaidEvent } from '../events';

// When payment succeeds, update bill status
EventBus.subscribe('payment.success', async (event: DomainEvent) => {
  const { paymentId, billId, userId, amount } = event.payload;
  
  console.log(`💰 Processing successful payment: ${paymentId} for bill: ${billId}`);
  
  // Update bill status
  await billingClient.bill.update({
    where: { id: billId },
    data: { status: 'PAID' },
  });
  
  console.log(`✅ Bill ${billId} marked as PAID`);
  
  // Publish bill paid event
  EventBus.publish(createBillPaidEvent(billId, userId, paymentId));
});

// Send notification on successful payment
EventBus.subscribe('payment.success', async (event: DomainEvent) => {
  const { paymentId, userId, amount } = event.payload;
  
  console.log(`📧 Sending payment success notification to user: ${userId}`);
  
  await notificationClient.notificationLog.create({
    data: {
      userId,
      type: 'PAYMENT_SUCCESS',
      status: 'SENT',
      message: `Your payment of $${amount} was successful. Payment ID: ${paymentId}`,
    },
  });
  
  console.log(`✅ Payment success notification sent to user: ${userId}`);
});

// Record payment in analytics
EventBus.subscribe('payment.success', async (event: DomainEvent) => {
  const { paymentId, userId, amount } = event.payload;
  
  console.log(`📊 Recording payment in analytics: ${paymentId}`);
  
  await analyticsClient.report.create({
    data: {
      title: 'Payment Processed',
      type: 'REVENUE',
      data: {
        paymentId,
        userId,
        amount: amount.toString(),
        timestamp: event.timestamp,
      },
      createdBy: userId,
    },
  });
  
  console.log(`✅ Payment recorded in analytics: ${paymentId}`);
});

// Handle payment failures
EventBus.subscribe('payment.failed', async (event: DomainEvent) => {
  const { paymentId, userId, reason } = event.payload;
  
  console.log(`❌ Processing failed payment: ${paymentId}`);
  
  await notificationClient.notificationLog.create({
    data: {
      userId,
      type: 'PAYMENT_FAILED',
      status: 'SENT',
      message: `Your payment failed. Reason: ${reason}. Payment ID: ${paymentId}`,
    },
  });
  
  console.log(`✅ Payment failure notification sent to user: ${userId}`);
});
