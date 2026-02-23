import EventBus, { DomainEvent } from '../EventBus';
import { billingClient } from '../../clients';

// Handle payment success - update bill status
EventBus.subscribe('payment.success', async (event: DomainEvent) => {
  const { billId, paymentId } = event.payload;
  
  await billingClient.bill.update({
    where: { id: billId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
  
  console.log(`✅ Bill ${billId} marked as paid`);
});

// Handle payment failure - update bill status
EventBus.subscribe('payment.failed', async (event: DomainEvent) => {
  const { billId } = event.payload;
  
  await billingClient.bill.update({
    where: { id: billId },
    data: { status: 'PAYMENT_FAILED' },
  });
  
  console.log(`✅ Bill ${billId} marked as payment failed`);
});

export {};
