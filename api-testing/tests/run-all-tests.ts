import { APITestConfig } from '../src/types/config';
import { APITestingFramework } from '../src/index';

// Configuration for the API testing framework
const config: APITestConfig = {
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  retries: 3,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'NEPA-API-Testing-Framework/1.0.0',
  },
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN || '',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/nepa_test',
    type: 'postgresql',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  services: {
    userService: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3002',
    documentService: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3003',
    utilityService: process.env.UTILITY_SERVICE_URL || 'http://localhost:3004',
    paymentService: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
    billingService: process.env.BILLING_SERVICE_URL || 'http://localhost:3006',
    analyticsService: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3007',
    webhookService: process.env.WEBHOOK_SERVICE_URL || 'http://localhost:3008',
  },
  performance: {
    concurrentUsers: 50,
    duration: 60000,
    rampUp: 10000,
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

// Initialize the testing framework
const framework = new APITestingFramework(config);

async function runAllTests(): Promise<void> {
  console.log('🚀 Starting comprehensive API testing...');
  console.log('=====================================');

  try {
    // Health check first
    console.log('\n📊 Performing health check...');
    const isHealthy = await framework.getTestClient().healthCheck();
    if (!isHealthy) {
      console.error('❌ API health check failed. Please ensure the API is running.');
      process.exit(1);
    }
    console.log('✅ API health check passed');

    // Run all test suites
    console.log('\n🧪 Running unit tests...');
    await framework.runUnitTests();

    console.log('\n🔗 Running integration tests...');
    await framework.runIntegrationTests();

    console.log('\n🎯 Running end-to-end tests...');
    await framework.runE2ETests();

    console.log('\n🔒 Running security tests...');
    await framework.runSecurityTests();

    console.log('\n⚡ Running performance tests...');
    await framework.runPerformanceTests();

    console.log('\n📋 Running contract tests...');
    await framework.runContractTests();

    console.log('\n📊 Generating test report...');
    await framework.generateReport();

    console.log('\n🎉 All tests completed successfully!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests, config, framework };
