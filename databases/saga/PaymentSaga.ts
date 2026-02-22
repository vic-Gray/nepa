// Payment Saga - Distributed transaction example
import sagaOrchestrator, { SagaStep } from './SagaOrchestrator';
import paymentClient from '../clients/paymentClient';
import billingClient from '../clients/billingClient';
import notificationClient from '../clients/notificationClient';
import analyticsClient from '../clients/analyticsClient';
import EventBus from '../event-patterns/EventBus';
import { createPaymentSuccessEvent, createPaymentFailedEvent } from '../event-patterns/events';

interface PaymentSagaData {
  userId: string;
  billId: string;
  amount: number;
  method: string;
  transactionId: string;
}

export class PaymentSaga {
  async executePayment(data: PaymentSagaData) {
    let paymentId: string;
    let billSnapshot: any;

    const steps: SagaStep[] = [
      // Step 1: Verify bill exists and is unpaid
      {
        name: 'verify-bill',
        execute: async () => {
          billSnapshot = await billingClient.bill.findUnique({
            where: { id: data.billId },
          });

          if (!billSnapshot) {
            throw new Error('Bill not found');
          }

          if (billSnapshot.status === 'PAID') {
            throw new Error('Bill already paid');
          }

          console.log(`  ℹ️  Bill verified: ${data.billId}`);
        },
        compensate: async () => {
          // No compensation needed for read operation
        },
      },

      // Step 2: Create payment record
      {
        name: 'create-payment',
        execute: async () => {
          const payment = await paymentClient.payment.create({
            data: {
              userId: data.userId,
              billId: data.billId,
              amount: data.amount,
              method: data.method,
              transactionId: data.transactionId,
              status: 'PENDING',
            },
          });
          paymentId = payment.id;
          console.log(`  ℹ️  Payment created: ${paymentId}`);
        },
        compensate: async () => {
          if (paymentId) {
            await paymentClient.payment.update({
              where: { id: paymentId },
              data: { status: 'FAILED' },
            });
            console.log(`  ℹ️  Payment marked as failed: ${paymentId}`);
          }
        },
      },

      // Step 3: Process payment (simulate external payment gateway)
      {
        name: 'process-payment',
        execute: async () => {
          // Simulate payment processing
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          // Update payment status
          await paymentClient.payment.update({
            where: { id: paymentId },
            data: { status: 'SUCCESS' },
          });
          console.log(`  ℹ️  Payment processed successfully: ${paymentId}`);
        },
        compensate: async () => {
          // Refund would happen here
          console.log(`  ℹ️  Initiating refund for payment: ${paymentId}`);
        },
      },

      // Step 4: Update bill status
      {
        name: 'update-bill',
        execute: async () => {
          await billingClient.bill.update({
            where: { id: data.billId },
            data: { status: 'PAID' },
          });
          console.log(`  ℹ️  Bill marked as paid: ${data.billId}`);
        },
        compensate: async () => {
          await billingClient.bill.update({
            where: { id: data.billId },
            data: { status: billSnapshot.status },
          });
          console.log(`  ℹ️  Bill status reverted: ${data.billId}`);
        },
      },

      // Step 5: Send notification
      {
        name: 'send-notification',
        execute: async () => {
          await notificationClient.notificationLog.create({
            data: {
              userId: data.userId,
              type: 'PAYMENT_SUCCESS',
              status: 'SENT',
              message: `Payment of $${data.amount} successful for bill ${data.billId}`,
            },
          });
          console.log(`  ℹ️  Notification sent to user: ${data.userId}`);
        },
        compensate: async () => {
          // Send failure notification
          await notificationClient.notificationLog.create({
            data: {
              userId: data.userId,
              type: 'PAYMENT_FAILED',
              status: 'SENT',
              message: `Payment failed for bill ${data.billId}`,
            },
          });
        },
      },

      // Step 6: Record in analytics
      {
        name: 'record-analytics',
        execute: async () => {
          await analyticsClient.report.create({
            data: {
              title: 'Payment Completed',
              type: 'REVENUE',
              data: {
                paymentId,
                billId: data.billId,
                userId: data.userId,
                amount: data.amount.toString(),
              },
              createdBy: data.userId,
            },
          });
          console.log(`  ℹ️  Analytics recorded for payment: ${paymentId}`);
        },
        compensate: async () => {
          // Analytics compensation could involve marking as reversed
        },
      },
    ];

    const result = await sagaOrchestrator.executeSaga('payment-saga', steps);

    // Publish domain event
    if (result.success) {
      EventBus.publish(
        createPaymentSuccessEvent(paymentId, data.billId, data.userId, data.amount)
      );
    } else {
      EventBus.publish(
        createPaymentFailedEvent(
          paymentId,
          data.billId,
          data.userId,
          result.error?.message || 'Unknown error'
        )
      );
    }

    return result;
  }
}

export default new PaymentSaga();
