import { APITestConfig } from '../src/types/config';
import { TestClient } from '../src/client/TestClient';
import { TestDataGenerator } from '../src/data/TestDataGenerator';
import { UserServiceTester } from '../src/services/UserServiceTester';
import { PaymentServiceTester } from '../src/services/PaymentServiceTester';

const config: APITestConfig = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  database: {
    url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/nepa_test',
    type: 'postgresql',
  },
  services: {
    userService: 'http://localhost:3001',
    notificationService: 'http://localhost:3002',
    documentService: 'http://localhost:3003',
    utilityService: 'http://localhost:3004',
    paymentService: 'http://localhost:3005',
    billingService: 'http://localhost:3006',
    analyticsService: 'http://localhost:3007',
    webhookService: 'http://localhost:3008',
  },
};

describe('API Integration Tests', () => {
  let testClient: TestClient;
  let dataGenerator: TestDataGenerator;
  let userServiceTester: UserServiceTester;
  let paymentServiceTester: PaymentServiceTester;

  beforeAll(() => {
    testClient = new TestClient(config);
    dataGenerator = new TestDataGenerator(config);
    userServiceTester = new UserServiceTester(testClient, dataGenerator);
    paymentServiceTester = new PaymentServiceTester(testClient, dataGenerator);
  });

  describe('User Service Integration', () => {
    it('should complete full user lifecycle', async () => {
      await userServiceTester.runAllTests();
    });

    it('should handle concurrent user operations', async () => {
      const users = dataGenerator.generateMultipleUsers(10);
      const promises = users.map(async (user) => {
        const result = await testClient.post('/api/auth/register', {
          email: user.email,
          username: user.username,
          name: user.name,
          password: user.password,
        });
        return result;
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(8); // Allow for some failures
    });
  });

  describe('Payment Service Integration', () => {
    it('should complete full payment flow', async () => {
      await paymentServiceTester.runAllTests();
    });

    it('should handle concurrent payment operations', async () => {
      const promises = Array.from({ length: 20 }, () => 
        testClient.get('/api/payments/history')
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(15); // Allow for some failures
    });
  });

  describe('Service Communication', () => {
    it('should handle cross-service operations', async () => {
      // Create user
      const user = dataGenerator.generateUser();
      const registerResult = await testClient.post('/api/auth/register', {
        email: user.email,
        username: user.username,
        name: user.name,
        password: user.password,
      });

      expect(registerResult.success).toBe(true);

      // Login user
      const loginResult = await testClient.post('/api/auth/login', {
        email: user.email,
        password: user.password,
      });

      expect(loginResult.success).toBe(true);
      const token = loginResult.response?.token;
      testClient.setAuthHeader(token);

      // Create bill
      const billResult = await testClient.post('/api/billing/bills', {
        userId: user.id,
        utilityType: 'electricity',
        provider: 'Test Utility',
        amount: 5000,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(billResult.success).toBe(true);

      // Initiate payment
      const paymentResult = await testClient.post('/api/payments/initiate', {
        billId: billResult.response.id,
        amount: 5000,
        method: 'stellar',
        transactionId: dataGenerator.generateRandomString(32),
      });

      expect(paymentResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid requests gracefully', async () => {
      const result = await testClient.post('/api/auth/register', {
        email: 'invalid-email',
        username: '',
        name: '',
        password: '123',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(400);
    });

    it('should handle missing resources', async () => {
      const result = await testClient.get('/api/bills/nonexistent');
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across services', async () => {
      const user = dataGenerator.generateUser();
      
      // Register user
      await testClient.post('/api/auth/register', {
        email: user.email,
        username: user.username,
        name: user.name,
        password: user.password,
      });

      // Login and get token
      const loginResult = await testClient.post('/api/auth/login', {
        email: user.email,
        password: user.password,
      });

      const token = loginResult.response?.token;
      testClient.setAuthHeader(token);

      // Create multiple bills
      const billPromises = Array.from({ length: 5 }, () =>
        testClient.post('/api/billing/bills', {
          userId: user.id,
          utilityType: 'electricity',
          provider: 'Test Utility',
          amount: dataGenerator.generateRandomAmount(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );

      const billResults = await Promise.all(billPromises);
      const createdBills = billResults.filter(r => r.success);
      expect(createdBills.length).toBe(5);

      // Verify all bills are retrievable
      const billsResult = await testClient.get('/api/billing/bills');
      expect(billsResult.success).toBe(true);
      expect(billsResult.response.length).toBeGreaterThanOrEqual(5);
    });
  });
});
