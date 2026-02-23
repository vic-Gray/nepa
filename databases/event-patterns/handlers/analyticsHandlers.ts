import EventBus, { DomainEvent } from '../EventBus';
import { analyticsClient } from '../../clients';

// Track all events for analytics
EventBus.subscribeAll(async (event: DomainEvent) => {
  if (event.eventType === '*') return; // Skip wildcard events
  
  await analyticsClient.analyticsEvent.create({
    data: {
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      userId: event.metadata?.userId || 'system',
      payload: JSON.stringify(event.payload),
      timestamp: event.timestamp,
    },
  });
  
  console.log(`📊 Analytics tracked: ${event.eventType}`);
});

export {};
