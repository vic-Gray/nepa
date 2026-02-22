// Domain Events for inter-service communication
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from './EventBus';

// User Service Events
export const createUserCreatedEvent = (userId: string, email: string): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'user.created',
  aggregateId: userId,
  timestamp: new Date(),
  payload: { userId, email },
});

export const createUserUpdatedEvent = (userId: string, changes: any): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'user.updated',
  aggregateId: userId,
  timestamp: new Date(),
  payload: { userId, changes },
});

// Billing Service Events
export const createBillCreatedEvent = (billId: string, userId: string, amount: number): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'bill.created',
  aggregateId: billId,
  timestamp: new Date(),
  payload: { billId, userId, amount },
});

export const createBillPaidEvent = (billId: string, userId: string, paymentId: string): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'bill.paid',
  aggregateId: billId,
  timestamp: new Date(),
  payload: { billId, userId, paymentId },
});

// Payment Service Events
export const createPaymentSuccessEvent = (
  paymentId: string,
  billId: string,
  userId: string,
  amount: number
): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'payment.success',
  aggregateId: paymentId,
  timestamp: new Date(),
  payload: { paymentId, billId, userId, amount },
});

export const createPaymentFailedEvent = (
  paymentId: string,
  billId: string,
  userId: string,
  reason: string
): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'payment.failed',
  aggregateId: paymentId,
  timestamp: new Date(),
  payload: { paymentId, billId, userId, reason },
});

// Notification Service Events
export const createNotificationSentEvent = (
  notificationId: string,
  userId: string,
  type: string
): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'notification.sent',
  aggregateId: notificationId,
  timestamp: new Date(),
  payload: { notificationId, userId, type },
});

// Document Service Events
export const createDocumentUploadedEvent = (
  documentId: string,
  userId: string,
  filename: string
): DomainEvent => ({
  eventId: uuidv4(),
  eventType: 'document.uploaded',
  aggregateId: documentId,
  timestamp: new Date(),
  payload: { documentId, userId, filename },
});
