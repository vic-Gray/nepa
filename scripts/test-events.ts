import EventBus from '../databases/event-patterns/EventBus';
import MessageBroker from '../databases/event-patterns/MessageBroker';
import { createPaymentSuccessEvent, createBillCreatedEvent } from '../databases/event-patterns/events';
import '../databases/event-patterns/handlers';

async function testEventDrivenArchitecture() {
  console.log('🧪 Testing Event-Driven Architecture\n');

  // Test 1: In-memory EventBus
  console.log('Test 1: EventBus (In-Memory)');
  const paymentEvent = createPaymentSuccessEvent('pay-123', 'bill-456', 'user-789', 100);
  EventBus.publish(paymentEvent);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Message Broker
  console.log('\nTest 2: RabbitMQ Message Broker');
  try {
    await MessageBroker.connect();
    
    const billEvent = createBillCreatedEvent('bill-999', 'user-789', 150);
    await MessageBroker.publish(billEvent);
    
    console.log('✅ Event published to RabbitMQ');
    
    await MessageBroker.subscribe('bill.*', async (event) => {
      console.log('📥 Received from RabbitMQ:', event.eventType);
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await MessageBroker.close();
  } catch (error) {
    console.log('⚠️ RabbitMQ not available, skipping broker test');
  }

  console.log('\n✅ Event-Driven Architecture tests completed');
}

testEventDrivenArchitecture().catch(console.error);
