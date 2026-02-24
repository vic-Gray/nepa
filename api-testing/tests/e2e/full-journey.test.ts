import { APITestConfig } from '../src/types/config';
import { APITestingFramework } from '../src/index';

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
  security: {
    enableVulnerabilityScan: true,
    enableRateLimitTest: true,
    enableAuthTest: true,
  },
  contract: {
    providerName: 'nepa-api',
    consumerName: 'test-consumer',
    pactDirectory: './contracts',
  },
  reporting: {
    outputDir: './test-reports',
    format: 'html',
    includeCoverage: true,
  },
};

const framework = new APITestingFramework(config);

describe('Security Tests', () => {
  it('should run all security tests', async () => {
    const results = await framework.runSecurityTests();
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // Check that critical security tests pass
    const criticalTests = results.filter(test => test.severity === 'critical' || test.severity === 'high');
    const failedCriticalTests = criticalTests.filter(test => !test.passed);
    expect(failedCriticalTests.length).toBe(0);
  });
});

describe('Performance Tests', () => {
  it('should run performance tests', async () => {
    const results = await framework.runPerformanceTests();
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // Check that performance is within acceptable limits
    results.forEach(result => {
      expect(result.avgResponseTime).toBeLessThan(2000); // 2 seconds max
      expect(result.errorRate).toBeLessThan(5); // 5% error rate max
    });
  });
});

describe('Contract Tests', () => {
  it('should run contract tests', async () => {
    const results = await framework.runContractTests();
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    // All contract tests should pass
    const failedTests = results.filter(test => !test.success);
    expect(failedTests.length).toBe(0);
  });
});

describe('End-to-End Tests', () => {
  it('should complete full user journey', async () => {
    const testClient = framework.getTestClient();
    const dataGenerator = framework.getDataGenerator();

    // Register user
    const user = dataGenerator.generateUser();
    const registerResult = await testClient.post('/api/auth/register', {
      email: user.email,
      username: user.username,
      name: user.name,
      password: user.password,
    });

    expect(registerResult.success).toBe(true);
    expect(registerResult.status).toBe(201);

    // Login user
    const loginResult = await testClient.post('/api/auth/login', {
      email: user.email,
      password: user.password,
    });

    expect(loginResult.success).toBe(true);
    expect(loginResult.status).toBe(200);

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
    expect(billResult.status).toBe(201);

    // Initiate payment
    const paymentResult = await testClient.post('/api/payments/initiate', {
      billId: billResult.response.id,
      amount: 5000,
      method: 'stellar',
      transactionId: dataGenerator.generateRandomString(32),
    });

    expect(paymentResult.success).toBe(true);
    expect(paymentResult.status).toBe(201);

    // Verify user profile
    const profileResult = await testClient.get('/api/users/profile');
    expect(profileResult.success).toBe(true);
    expect(profileResult.status).toBe(200);

    // Verify bills
    const billsResult = await testClient.get('/api/billing/bills');
    expect(billsResult.success).toBe(true);
    expect(billsResult.status).toBe(200);
    expect(billsResult.response.length).toBeGreaterThan(0);

    // Verify payment history
    const paymentsResult = await testClient.get('/api/payments/history');
    expect(paymentsResult.success).toBe(true);
    expect(paymentsResult.status).toBe(200);
  });
});
