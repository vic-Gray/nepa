import { TestClient } from '../client/TestClient';
import { TestDataGenerator, TestBill, TestPayment } from '../data/TestDataGenerator';
import { APITestConfig } from '../types/config';

export class PaymentServiceTester {
  private client: TestClient;
  private dataGenerator: TestDataGenerator;

  constructor(client: TestClient, dataGenerator: TestDataGenerator) {
    this.client = client;
    this.dataGenerator = dataGenerator;
  }

  async testBillCreation(): Promise<TestBill> {
    console.log('Testing bill creation...');

    const user = this.dataGenerator.generateUser();
    const billData = {
      userId: user.id,
      utilityType: 'electricity',
      provider: 'Test Utility Company',
      amount: this.dataGenerator.generateRandomAmount(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      meterNumber: this.dataGenerator.generateRandomString(10),
    };

    const result = await this.client.post('/api/billing/bills', billData);
    
    if (!result.success) {
      throw new Error(`Bill creation failed: ${result.error}`);
    }

    const bill: TestBill = {
      id: result.response.id,
      userId: billData.userId,
      utilityType: billData.utilityType,
      provider: billData.provider,
      amount: billData.amount,
      dueDate: new Date(billData.dueDate),
      status: 'pending',
      meterNumber: billData.meterNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('✓ Bill creation successful');
    return bill;
  }

  async testBillRetrieval(): Promise<void> {
    console.log('Testing bill retrieval...');

    const result = await this.client.get('/api/billing/bills');
    
    if (!result.success) {
      throw new Error(`Bill retrieval failed: ${result.error}`);
    }

    console.log('✓ Bill retrieval successful');
  }

  async testPaymentInitiation(): Promise<TestPayment> {
    console.log('Testing payment initiation...');

    const bill = await this.testBillCreation();
    const paymentData = {
      billId: bill.id,
      amount: bill.amount,
      method: 'stellar',
      transactionId: this.dataGenerator.generateRandomString(32),
    };

    const result = await this.client.post('/api/payments/initiate', paymentData);
    
    if (!result.success) {
      throw new Error(`Payment initiation failed: ${result.error}`);
    }

    const payment: TestPayment = {
      id: result.response.id,
      billId: paymentData.billId,
      userId: bill.userId,
      amount: paymentData.amount,
      method: paymentData.method,
      transactionId: paymentData.transactionId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('✓ Payment initiation successful');
    return payment;
  }

  async testPaymentConfirmation(): Promise<void> {
    console.log('Testing payment confirmation...');

    const payment = await this.testPaymentInitiation();
    const confirmationData = {
      paymentId: payment.id,
      status: 'completed',
      transactionHash: this.dataGenerator.generateRandomString(64),
    };

    const result = await this.client.post('/api/payments/confirm', confirmationData);
    
    if (!result.success) {
      throw new Error(`Payment confirmation failed: ${result.error}`);
    }

    console.log('✓ Payment confirmation successful');
  }

  async testPaymentHistory(): Promise<void> {
    console.log('Testing payment history...');

    const result = await this.client.get('/api/payments/history');
    
    if (!result.success) {
      throw new Error(`Payment history retrieval failed: ${result.error}`);
    }

    console.log('✓ Payment history retrieval successful');
  }

  async testStellarPayment(): Promise<void> {
    console.log('Testing Stellar payment...');

    const stellarData = {
      billId: this.dataGenerator.generateRandomString(),
      amount: this.dataGenerator.generateRandomAmount(),
      destinationAddress: 'GABCDEFG...',
      memo: this.dataGenerator.generateRandomString(20),
    };

    const result = await this.client.post('/api/payments/stellar', stellarData);
    
    if (!result.success) {
      throw new Error(`Stellar payment failed: ${result.error}`);
    }

    console.log('✓ Stellar payment successful');
  }

  async testRefundProcess(): Promise<void> {
    console.log('Testing refund process...');

    const refundData = {
      paymentId: this.dataGenerator.generateRandomString(),
      amount: this.dataGenerator.generateRandomAmount(),
      reason: 'Customer requested refund',
    };

    const result = await this.client.post('/api/payments/refund', refundData);
    
    if (!result.success) {
      throw new Error(`Refund process failed: ${result.error}`);
    }

    console.log('✓ Refund process successful');
  }

  async testPaymentValidation(): Promise<void> {
    console.log('Testing payment validation...');

    const invalidPaymentData = {
      billId: '',
      amount: -100,
      method: 'invalid',
    };

    const result = await this.client.post('/api/payments/initiate', invalidPaymentData);
    
    if (result.success) {
      throw new Error('Payment validation should have failed');
    }

    console.log('✓ Payment validation successful');
  }

  async runAllTests(): Promise<void> {
    try {
      await this.testBillCreation();
      await this.testBillRetrieval();
      await this.testPaymentInitiation();
      await this.testPaymentConfirmation();
      await this.testPaymentHistory();
      await this.testStellarPayment();
      await this.testRefundProcess();
      await this.testPaymentValidation();
      console.log('✓ All payment service tests passed');
    } catch (error) {
      console.error('✗ Payment service tests failed:', error);
      throw error;
    }
  }
}
