// Initialize all event handlers
import './handlers/UserEventHandlers';
import './handlers/PaymentEventHandlers';
import './handlers/BillEventHandlers';

export { default as EventBus } from './EventBus';
export * from './events';

console.log('✅ Event handlers initialized');
