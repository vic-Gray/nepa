import MessageBroker from '../../databases/event-patterns/MessageBroker';
import AsyncEventProcessor from '../../databases/event-patterns/AsyncEventProcessor';
import { DomainEvent } from '../../databases/event-patterns/EventBus';
import '../../databases/event-patterns/handlers';

const processor = new AsyncEventProcessor({ maxRetries: 3, retryDelay: 1000 });

async function startEventConsumer() {
  console.log('🚀 Starting Event Consumer...');
  await MessageBroker.connect();

  await MessageBroker.subscribe('payment.*', async (event: DomainEvent) => {
    await processor.process(event, async (e) => console.log(`✅ ${e.eventType}`));
  });

  await MessageBroker.subscribe('bill.*', async (event: DomainEvent) => {
    await processor.process(event, async (e) => console.log(`✅ ${e.eventType}`));
  });

  console.log('✅ Event Consumer running');
}

startEventConsumer().catch(console.error);

process.on('SIGINT', async () => {
  await MessageBroker.close();
  process.exit(0);
});
