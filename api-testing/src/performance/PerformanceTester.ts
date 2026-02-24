import { TestClient } from '../client/TestClient';
import { TestDataGenerator } from '../data/TestDataGenerator';
import { APITestConfig, PerformanceTestResult } from '../types/config';

export class PerformanceTester {
  private client: TestClient;
  private dataGenerator: TestDataGenerator;
  private config: APITestConfig;

  constructor(config: APITestConfig) {
    this.config = config;
    this.client = new TestClient(config);
    this.dataGenerator = new TestDataGenerator(config);
  }

  async testEndpointPerformance(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    requests: number = 100
  ): Promise<PerformanceTestResult> {
    console.log(`Testing performance of ${method} ${endpoint} with ${requests} requests...`);

    const responseTimes: number[] = [];
    let errors = 0;
    const startTime = Date.now();

    for (let i = 0; i < requests; i++) {
      const requestStart = Date.now();
      
      try {
        let result;
        switch (method) {
          case 'GET':
            result = await this.client.get(endpoint);
            break;
          case 'POST':
            result = await this.client.post(endpoint, data);
            break;
          case 'PUT':
            result = await this.client.put(endpoint, data);
            break;
          case 'DELETE':
            result = await this.client.delete(endpoint);
            break;
        }

        if (!result.success) {
          errors++;
        }
      } catch (error) {
        errors++;
      }

      responseTimes.push(Date.now() - requestStart);
    }

    const duration = Date.now() - startTime;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = (requests / duration) * 1000;
    const errorRate = (errors / requests) * 100;

    const result: PerformanceTestResult = {
      url: `${this.config.baseURL}${endpoint}`,
      method,
      requests,
      duration,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      errors,
      errorRate,
    };

    console.log(`✓ Performance test completed for ${method} ${endpoint}`);
    console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Requests per second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`  Error rate: ${errorRate.toFixed(2)}%`);

    return result;
  }

  async testLoadBalancing(): Promise<PerformanceTestResult[]> {
    console.log('Testing load balancing...');
    const results: PerformanceTestResult[] = [];

    const endpoints = [
      '/api/users/profile',
      '/api/billing/bills',
      '/api/payments/history',
    ];

    for (const endpoint of endpoints) {
      const result = await this.testEndpointPerformance(endpoint, 'GET', undefined, 50);
      results.push(result);
    }

    return results;
  }

  async testConcurrentRequests(): Promise<PerformanceTestResult> {
    console.log('Testing concurrent requests...');
    
    const concurrentUsers = this.config.performance?.concurrentUsers || 50;
    const requestsPerUser = 10;
    const endpoint = '/api/users/profile';

    const promises: Promise<any>[] = [];
    const responseTimes: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let user = 0; user < concurrentUsers; user++) {
      const userPromises = [];
      
      for (let req = 0; req < requestsPerUser; req++) {
        const requestStart = Date.now();
        
        const promise = this.client.get(endpoint).then(result => {
          responseTimes.push(Date.now() - requestStart);
          if (!result.success) errors++;
        }).catch(() => {
          responseTimes.push(Date.now() - requestStart);
          errors++;
        });
        
        userPromises.push(promise);
      }
      
      promises.push(Promise.all(userPromises));
    }

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    const totalRequests = concurrentUsers * requestsPerUser;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = (totalRequests / duration) * 1000;
    const errorRate = (errors / totalRequests) * 100;

    const result: PerformanceTestResult = {
      url: `${this.config.baseURL}${endpoint}`,
      method: 'GET',
      requests: totalRequests,
      duration,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      errors,
      errorRate,
    };

    console.log(`✓ Concurrent request test completed`);
    console.log(`  Concurrent users: ${concurrentUsers}`);
    console.log(`  Total requests: ${totalRequests}`);
    console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Requests per second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`  Error rate: ${errorRate.toFixed(2)}%`);

    return result;
  }

  async testDatabasePerformance(): Promise<PerformanceTestResult[]> {
    console.log('Testing database performance...');
    const results: PerformanceTestResult[] = [];

    // Test user creation performance
    const userData = {
      email: this.dataGenerator.generateRandomEmail(),
      username: this.dataGenerator.generateRandomString(8),
      name: 'Performance Test User',
      password: 'password123',
    };

    const userCreationResult = await this.testEndpointPerformance(
      '/api/auth/register',
      'POST',
      userData,
      50
    );
    results.push(userCreationResult);

    // Test bill creation performance
    const billData = {
      userId: this.dataGenerator.generateRandomString(),
      utilityType: 'electricity',
      provider: 'Test Utility',
      amount: 5000,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const billCreationResult = await this.testEndpointPerformance(
      '/api/billing/bills',
      'POST',
      billData,
      50
    );
    results.push(billCreationResult);

    return results;
  }

  async testMemoryUsage(): Promise<{ peakMemoryUsage: number; averageMemoryUsage: number }> {
    console.log('Testing memory usage...');

    const initialMemory = process.memoryUsage().heapUsed;
    const memoryReadings: number[] = [];

    // Perform memory-intensive operations
    for (let i = 0; i < 100; i++) {
      await this.testEndpointPerformance('/api/users/profile', 'GET', undefined, 10);
      memoryReadings.push(process.memoryUsage().heapUsed);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const peakMemoryUsage = Math.max(...memoryReadings);
    const averageMemoryUsage = memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length;

    console.log(`✓ Memory usage test completed`);
    console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Peak memory: ${(peakMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Average memory: ${(averageMemoryUsage / 1024 / 1024).toFixed(2)} MB`);

    return {
      peakMemoryUsage,
      averageMemoryUsage,
    };
  }

  async testStressTest(): Promise<PerformanceTestResult> {
    console.log('Running stress test...');

    const duration = this.config.performance?.duration || 60000; // 1 minute default
    const rampUp = this.config.performance?.rampUp || 10000; // 10 seconds ramp up
    const endpoint = '/api/users/profile';

    const startTime = Date.now();
    const endTime = startTime + duration;
    const responseTimes: number[] = [];
    let errors = 0;
    let totalRequests = 0;

    while (Date.now() < endTime) {
      const concurrentRequests = Math.min(
        Math.floor(((Date.now() - startTime) / rampUp) * 10) + 1,
        50
      );

      const promises = [];
      for (let i = 0; i < concurrentRequests; i++) {
        const requestStart = Date.now();
        const promise = this.client.get(endpoint).then(result => {
          responseTimes.push(Date.now() - requestStart);
          totalRequests++;
          if (!result.success) errors++;
        }).catch(() => {
          responseTimes.push(Date.now() - requestStart);
          totalRequests++;
          errors++;
        });
        promises.push(promise);
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const testDuration = Date.now() - startTime;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = (totalRequests / testDuration) * 1000;
    const errorRate = (errors / totalRequests) * 100;

    const result: PerformanceTestResult = {
      url: `${this.config.baseURL}${endpoint}`,
      method: 'GET',
      requests: totalRequests,
      duration: testDuration,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      errors,
      errorRate,
    };

    console.log(`✓ Stress test completed`);
    console.log(`  Total duration: ${(testDuration / 1000).toFixed(2)}s`);
    console.log(`  Total requests: ${totalRequests}`);
    console.log(`  Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Requests per second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`  Error rate: ${errorRate.toFixed(2)}%`);

    return result;
  }

  async runAllTests(): Promise<PerformanceTestResult[]> {
    console.log('Running performance tests...');
    
    const allResults: PerformanceTestResult[] = [];
    
    try {
      // Basic endpoint performance tests
      allResults.push(await this.testEndpointPerformance('/api/users/profile', 'GET'));
      allResults.push(await this.testEndpointPerformance('/api/billing/bills', 'POST', {
        userId: 'test-user',
        utilityType: 'electricity',
        provider: 'Test Utility',
        amount: 5000,
      }));
      allResults.push(await this.testEndpointPerformance('/api/payments/history', 'GET'));

      // Advanced performance tests
      allResults.push(...await this.testLoadBalancing());
      allResults.push(await this.testConcurrentRequests());
      allResults.push(...await this.testDatabasePerformance());
      allResults.push(await this.testStressTest());

      // Memory usage test
      await this.testMemoryUsage();

      console.log('✓ All performance tests completed');
      return allResults;
    } catch (error) {
      console.error('✗ Performance tests failed:', error);
      throw error;
    }
  }
}
