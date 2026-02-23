import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { DomainEvent } from './EventBus';

class MessageBroker {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly url: string;
  private readonly exchange = 'nepa.events';

  constructor(url: string = process.env.RABBITMQ_URL || 'amqp://localhost') {
    this.url = url;
  }

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    console.log('✅ Connected to RabbitMQ');
  }

  async publish(event: DomainEvent): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');
    
    const routingKey = event.eventType;
    this.channel.publish(
      this.exchange,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true, contentType: 'application/json' }
    );
  }

  async subscribe(pattern: string, handler: (event: DomainEvent) => Promise<void>): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    const queue = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue.queue, this.exchange, pattern);

    this.channel.consume(queue.queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      
      try {
        const event: DomainEvent = JSON.parse(msg.content.toString());
        await handler(event);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        this.channel!.nack(msg, false, false);
      }
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

export default new MessageBroker();
