// Event Bus for inter-service communication
import { EventEmitter } from 'events';

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  timestamp: Date;
  payload: any;
  metadata?: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
}

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100); // Increase for multiple services
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  publish(event: DomainEvent): void {
    console.log(`📤 Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
    });
    this.emit(event.eventType, event);
    this.emit('*', event); // Wildcard for logging/monitoring
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    this.on(eventType, async (event: DomainEvent) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`❌ Error handling event ${eventType}:`, error);
        // Implement retry logic or dead letter queue here
      }
    });
  }

  subscribeAll(handler: (event: DomainEvent) => Promise<void>): void {
    this.subscribe('*', handler);
  }
}

export default EventBus.getInstance();
