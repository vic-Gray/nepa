import { TestClient } from '../client/TestClient';
import { TestDataGenerator } from '../data/TestDataGenerator';
import { APITestConfig, ContractTestResult } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

export class ContractTester {
  private client: TestClient;
  private dataGenerator: TestDataGenerator;
  private config: APITestConfig;
  private contractDir: string;

  constructor(config: APITestConfig) {
    this.config = config;
    this.client = new TestClient(config);
    this.dataGenerator = new TestDataGenerator(config);
    this.contractDir = config.contract?.pactDirectory || path.join(process.cwd(), 'contracts');
    
    // Ensure contract directory exists
    if (!fs.existsSync(this.contractDir)) {
      fs.mkdirSync(this.contractDir, { recursive: true });
    }
  }

  async testUserServiceContract(): Promise<ContractTestResult> {
    console.log('Testing user service contract...');
    
    const consumer = this.config.contract?.consumerName || 'frontend';
    const provider = this.config.contract?.providerName || 'user-service';
    
    try {
      // Test user registration contract
      const userData = {
        email: this.dataGenerator.generateRandomEmail(),
        username: this.dataGenerator.generateRandomString(8),
        name: 'Contract Test User',
        password: 'password123',
      };

      const registerResult = await this.client.post('/api/auth/register', userData);
      
      if (!registerResult.success || registerResult.status !== 201) {
        return {
          consumer,
          provider,
          interaction: 'user-registration',
          success: false,
          errors: [`Expected status 201, got ${registerResult.status}`],
        };
      }

      // Verify response structure
      const response = registerResult.response;
      const requiredFields = ['message', 'user'];
      const missingFields = requiredFields.filter(field => !response[field]);

      if (missingFields.length > 0) {
        return {
          consumer,
          provider,
          interaction: 'user-registration',
          success: false,
          errors: [`Missing required fields: ${missingFields.join(', ')}`],
        };
      }

      // Test user login contract
      const loginResult = await this.client.post('/api/auth/login', {
        email: userData.email,
        password: userData.password,
      });

      if (!loginResult.success || loginResult.status !== 200) {
        return {
          consumer,
          provider,
          interaction: 'user-login',
          success: false,
          errors: [`Expected status 200, got ${loginResult.status}`],
        };
      }

      // Verify login response structure
      const loginResponse = loginResult.response;
      const loginRequiredFields = ['token', 'user'];
      const loginMissingFields = loginRequiredFields.filter(field => !loginResponse[field]);

      if (loginMissingFields.length > 0) {
        return {
          consumer,
          provider,
          interaction: 'user-login',
          success: false,
          errors: [`Missing required fields: ${loginMissingFields.join(', ')}`],
        };
      }

      return {
        consumer,
        provider,
        interaction: 'user-service',
        success: true,
      };
    } catch (error) {
      return {
        consumer,
        provider,
        interaction: 'user-service',
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async testBillingServiceContract(): Promise<ContractTestResult> {
    console.log('Testing billing service contract...');
    
    const consumer = this.config.contract?.consumerName || 'frontend';
    const provider = 'billing-service';
    
    try {
      // Test bill creation contract
      const billData = {
        userId: this.dataGenerator.generateRandomString(),
        utilityType: 'electricity',
        provider: 'Test Utility Company',
        amount: 5000,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        meterNumber: this.dataGenerator.generateRandomString(10),
      };

      const createResult = await this.client.post('/api/billing/bills', billData);
      
      if (!createResult.success || createResult.status !== 201) {
        return {
          consumer,
          provider,
          interaction: 'bill-creation',
          success: false,
          errors: [`Expected status 201, got ${createResult.status}`],
        };
      }

      // Verify bill structure
      const bill = createResult.response;
      const requiredFields = ['id', 'userId', 'utilityType', 'provider', 'amount', 'dueDate', 'status'];
      const missingFields = requiredFields.filter(field => !bill[field]);

      if (missingFields.length > 0) {
        return {
          consumer,
          provider,
          interaction: 'bill-creation',
          success: false,
          errors: [`Missing required fields: ${missingFields.join(', ')}`],
        };
      }

      // Test bill retrieval contract
      const getResult = await this.client.get('/api/billing/bills');
      
      if (!getResult.success || getResult.status !== 200) {
        return {
          consumer,
          provider,
          interaction: 'bill-retrieval',
          success: false,
          errors: [`Expected status 200, got ${getResult.status}`],
        };
      }

      // Verify bills array structure
      const bills = getResult.response;
      if (!Array.isArray(bills)) {
        return {
          consumer,
          provider,
          interaction: 'bill-retrieval',
          success: false,
          errors: ['Expected array of bills, got ' + typeof bills],
        };
      }

      return {
        consumer,
        provider,
        interaction: 'billing-service',
        success: true,
      };
    } catch (error) {
      return {
        consumer,
        provider,
        interaction: 'billing-service',
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async testPaymentServiceContract(): Promise<ContractTestResult> {
    console.log('Testing payment service contract...');
    
    const consumer = this.config.contract?.consumerName || 'frontend';
    const provider = 'payment-service';
    
    try {
      // Test payment initiation contract
      const paymentData = {
        billId: this.dataGenerator.generateRandomString(),
        amount: 5000,
        method: 'stellar',
        transactionId: this.dataGenerator.generateRandomString(32),
      };

      const initiateResult = await this.client.post('/api/payments/initiate', paymentData);
      
      if (!initiateResult.success || initiateResult.status !== 201) {
        return {
          consumer,
          provider,
          interaction: 'payment-initiation',
          success: false,
          errors: [`Expected status 201, got ${initiateResult.status}`],
        };
      }

      // Verify payment structure
      const payment = initiateResult.response;
      const requiredFields = ['id', 'billId', 'amount', 'method', 'status'];
      const missingFields = requiredFields.filter(field => !payment[field]);

      if (missingFields.length > 0) {
        return {
          consumer,
          provider,
          interaction: 'payment-initiation',
          success: false,
          errors: [`Missing required fields: ${missingFields.join(', ')}`],
        };
      }

      // Test payment history contract
      const historyResult = await this.client.get('/api/payments/history');
      
      if (!historyResult.success || historyResult.status !== 200) {
        return {
          consumer,
          provider,
          interaction: 'payment-history',
          success: false,
          errors: [`Expected status 200, got ${historyResult.status}`],
        };
      }

      // Verify payments array structure
      const payments = historyResult.response;
      if (!Array.isArray(payments)) {
        return {
          consumer,
          provider,
          interaction: 'payment-history',
          success: false,
          errors: ['Expected array of payments, got ' + typeof payments],
        };
      }

      return {
        consumer,
        provider,
        interaction: 'payment-service',
        success: true,
      };
    } catch (error) {
      return {
        consumer,
        provider,
        interaction: 'payment-service',
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async testNotificationServiceContract(): Promise<ContractTestResult> {
    console.log('Testing notification service contract...');
    
    const consumer = this.config.contract?.consumerName || 'frontend';
    const provider = 'notification-service';
    
    try {
      // Test notification preferences contract
      const preferencesData = {
        email: true,
        sms: false,
        push: true,
        inApp: true,
      };

      const preferencesResult = await this.client.put('/api/notifications/preferences', preferencesData);
      
      if (!preferencesResult.success || preferencesResult.status !== 200) {
        return {
          consumer,
          provider,
          interaction: 'notification-preferences',
          success: false,
          errors: [`Expected status 200, got ${preferencesResult.status}`],
        };
      }

      // Test notification history contract
      const historyResult = await this.client.get('/api/notifications/history');
      
      if (!historyResult.success || historyResult.status !== 200) {
        return {
          consumer,
          provider,
          interaction: 'notification-history',
          success: false,
          errors: [`Expected status 200, got ${historyResult.status}`],
        };
      }

      // Verify notifications array structure
      const notifications = historyResult.response;
      if (!Array.isArray(notifications)) {
        return {
          consumer,
          provider,
          interaction: 'notification-history',
          success: false,
          errors: ['Expected array of notifications, got ' + typeof notifications],
        };
      }

      return {
        consumer,
        provider,
        interaction: 'notification-service',
        success: true,
      };
    } catch (error) {
      return {
        consumer,
        provider,
        interaction: 'notification-service',
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async generateContractFile(result: ContractTestResult): Promise<void> {
    const contractFile = path.join(this.contractDir, `${result.consumer}-${result.provider}.json`);
    
    const contract = {
      consumer: { name: result.consumer },
      provider: { name: result.provider },
      interactions: [
        {
          description: `${result.interaction} contract test`,
          request: {
            method: 'POST',
            path: `/api/${result.interaction.split('-')[0]}`,
          },
          response: {
            status: result.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          },
        },
      ],
      metadata: {
        pactSpecification: { version: '2.0.0' },
        createdAt: new Date().toISOString(),
      },
    };

    fs.writeFileSync(contractFile, JSON.stringify(contract, null, 2));
    console.log(`✓ Contract file generated: ${contractFile}`);
  }

  async verifyContract(consumer: string, provider: string): Promise<boolean> {
    console.log(`Verifying contract between ${consumer} and ${provider}...`);
    
    const contractFile = path.join(this.contractDir, `${consumer}-${provider}.json`);
    
    if (!fs.existsSync(contractFile)) {
      console.log(`✗ Contract file not found: ${contractFile}`);
      return false;
    }

    try {
      const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
      
      // Verify contract structure
      if (!contract.consumer || !contract.provider || !contract.interactions) {
        console.log(`✗ Invalid contract structure`);
        return false;
      }

      console.log(`✓ Contract verification successful`);
      return true;
    } catch (error) {
      console.log(`✗ Contract verification failed:`, error);
      return false;
    }
  }

  async runAllTests(): Promise<ContractTestResult[]> {
    console.log('Running contract tests...');
    
    const allResults: ContractTestResult[] = [];
    
    try {
      // Test all service contracts
      const userResult = await this.testUserServiceContract();
      allResults.push(userResult);
      await this.generateContractFile(userResult);

      const billingResult = await this.testBillingServiceContract();
      allResults.push(billingResult);
      await this.generateContractFile(billingResult);

      const paymentResult = await this.testPaymentServiceContract();
      allResults.push(paymentResult);
      await this.generateContractFile(paymentResult);

      const notificationResult = await this.testNotificationServiceContract();
      allResults.push(notificationResult);
      await this.generateContractFile(notificationResult);

      const failedTests = allResults.filter(result => !result.success);
      
      if (failedTests.length === 0) {
        console.log('✓ All contract tests passed');
      } else {
        console.log(`✗ ${failedTests.length} contract tests failed`);
        failedTests.forEach(test => {
          console.log(`  - ${test.interaction}: ${test.errors?.join(', ')}`);
        });
      }

      return allResults;
    } catch (error) {
      console.error('✗ Contract tests failed:', error);
      throw error;
    }
  }
}
