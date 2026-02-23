import { DomainEvent } from './EventBus';
import MessageBroker from './MessageBroker';

interface ProcessorConfig {
  maxRetries: number;
  retryDelay: number;
  deadLetterQueue: string;
}

class AsyncEventProcessor {
  private config: ProcessorConfig;

  constructor(config: Partial<ProcessorConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      deadLetterQueue: config.deadLetterQueue || 'dlq',
    };
  }

  async process(
    event: DomainEvent,
    handler: (event: DomainEvent) => Promise<void>,
    attempt = 0
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        console.log(`⚠️ Retry ${attempt + 1}/${this.config.maxRetries} for ${event.eventType}`);
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        return this.process(event, handler, attempt + 1);
      }
      
      console.error(`❌ Failed after ${this.config.maxRetries} retries:`, error);
      await this.sendToDeadLetterQueue(event, error);
    }
  }

  private async sendToDeadLetterQueue(event: DomainEvent, error: any): Promise<void> {
    const dlqEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        error: error.message,
        failedAt: new Date().toISOString(),
      },
    };
    
    console.log(`📮 Sending to DLQ: ${event.eventType}`);
    // Store in DLQ for manual processing
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AsyncEventProcessor;
