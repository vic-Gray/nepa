#!/usr/bin/env ts-node
// Test the Payment Saga implementation
import PaymentSaga from '../databases/saga/PaymentSaga';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('🧪 Testing Payment Saga...\n');

  const testData = {
    userId: uuidv4(),
    billId: uuidv4(),
    amount: 100.50,
    method: 'STELLAR',
    transactionId: `TXN_${Date.now()}`,
  };

  console.log('Test Data:', testData);
  console.log('\n🔄 Executing saga...\n');

  const result = await PaymentSaga.executePayment(testData);

  console.log('\n📊 Saga Result:');
  console.log(`  Saga ID: ${result.sagaId}`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Completed Steps: ${result.completedSteps.join(', ')}`);

  if (!result.success) {
    console.log(`  Failed Step: ${result.failedStep}`);
    console.log(`  Error: ${result.error?.message}`);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Saga test failed:', error);
  process.exit(1);
});
