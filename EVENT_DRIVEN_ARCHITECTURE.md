# Event-Driven Architecture

## Overview

Fully decoupled microservices using event-driven communication with RabbitMQ message broker and event sourcing.

## Architecture Components

### 1. Event Bus (In-Memory)
- Fast synchronous event processing
- Development and testing
- Located: `databases/event-patterns/EventBus.ts`

### 2. Message Broker (RabbitMQ)
- Asynchronous event processing
- Persistent message queues
- Production-ready with retry logic
- Located: `databases/event-patterns/MessageBroker.ts`

### 3. Event Store
- Event sourcing for audit trails
- State reconstruction capability
- Located: `databases/event-patterns/EventStore.ts`

### 4. Async Event Processor
- Retry logic with exponential backoff
- Dead letter queue for failed events
- Located: `databases/event-patterns/AsyncEventProcessor.ts`

## Event Flow

```
Service A → Publish Event → [EventBus + MessageBroker]
                                    ↓
                            Event Handlers
                                    ↓
                    [Notification, Billing, Analytics Services]
```

## Domain Events

### Payment Events
- `payment.success` - Payment completed successfully
- `payment.failed` - Payment failed

### Billing Events
- `bill.created` - New bill generated
- `bill.paid` - Bill marked as paid

### User Events
- `user.created` - New user registered
- `user.updated` - User profile updated

### Notification Events
- `notification.sent` - Notification delivered

### Document Events
- `document.uploaded` - Document uploaded

## Event Handlers

### Notification Handlers
- Listen: `payment.success`, `payment.failed`, `bill.created`
- Action: Send email/SMS notifications

### Billing Handlers
- Listen: `payment.success`, `payment.failed`
- Action: Update bill status

### Analytics Handlers
- Listen: All events (`*`)
- Action: Track for analytics and reporting

## Setup

### 1. Start Message Broker
```bash
npm run messaging:start
```

### 2. Access RabbitMQ Management UI
- URL: http://localhost:15672
- User: admin
- Pass: admin

### 3. Initialize Event Handlers
Event handlers auto-initialize when services start.

## Usage

### Publishing Events
```typescript
import EventBus from './databases/event-patterns/EventBus';
import MessageBroker from './databases/event-patterns/MessageBroker';
import { createPaymentSuccessEvent } from './databases/event-patterns/events';

const event = createPaymentSuccessEvent(paymentId, billId, userId, amount);

// In-memory (fast)
EventBus.publish(event);

// Persistent queue (reliable)
await MessageBroker.publish(event);
```

### Subscribing to Events
```typescript
import EventBus from './databases/event-patterns/EventBus';

EventBus.subscribe('payment.success', async (event) => {
  // Handle event
  console.log('Payment successful:', event.payload);
});
```

### Event Sourcing
```typescript
import EventStore from './databases/event-patterns/EventStore';
import { analyticsClient } from './databases/clients';

const eventStore = new EventStore({ client: analyticsClient });

// Append event
await eventStore.append(event);

// Get all events for aggregate
const events = await eventStore.getEvents(aggregateId);

// Replay events
await eventStore.replay(aggregateId, async (event) => {
  // Reconstruct state
});
```

## Benefits Achieved

✅ **Decoupled Services** - Services don't directly depend on each other
✅ **Async Processing** - Non-blocking event handling
✅ **Fault Tolerance** - Retry logic and dead letter queues
✅ **Audit Trail** - Complete event history via event sourcing
✅ **Scalability** - Independent event consumers
✅ **Real-time Sync** - Automatic data propagation across services

## Monitoring

### RabbitMQ Metrics
- Queue depth
- Message rates
- Consumer count
- Failed deliveries

### Event Metrics
- Events published per type
- Processing latency
- Retry counts
- DLQ size

## Configuration

```env
RABBITMQ_URL=amqp://localhost
RABBITMQ_USER=admin
RABBITMQ_PASS=admin
REDIS_URL=redis://localhost:6379
```
