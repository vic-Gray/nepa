import { DomainEvent } from './EventBus';

interface EventStoreConfig {
  client: any; // Prisma client
}

class EventStore {
  private client: any;

  constructor(config: EventStoreConfig) {
    this.client = config.client;
  }

  async append(event: DomainEvent): Promise<void> {
    await this.client.eventStore.create({
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        payload: JSON.stringify(event.payload),
        metadata: JSON.stringify(event.metadata || {}),
        timestamp: event.timestamp,
      },
    });
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const events = await this.client.eventStore.findMany({
      where: { aggregateId },
      orderBy: { timestamp: 'asc' },
    });

    return events.map((e: any) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      aggregateId: e.aggregateId,
      timestamp: e.timestamp,
      payload: JSON.parse(e.payload),
      metadata: JSON.parse(e.metadata),
    }));
  }

  async getEventsByType(eventType: string, limit = 100): Promise<DomainEvent[]> {
    const events = await this.client.eventStore.findMany({
      where: { eventType },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return events.map((e: any) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      aggregateId: e.aggregateId,
      timestamp: e.timestamp,
      payload: JSON.parse(e.payload),
      metadata: JSON.parse(e.metadata),
    }));
  }

  async replay(aggregateId: string, handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    const events = await this.getEvents(aggregateId);
    for (const event of events) {
      await handler(event);
    }
  }
}

export default EventStore;
