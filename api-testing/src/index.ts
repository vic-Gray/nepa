import { TestClient } from './client/TestClient';
import { TestDataGenerator } from './data/TestDataGenerator';
import { TestReporter } from './reporting/TestReporter';
import { SecurityTester } from './security/SecurityTester';
import { PerformanceTester } from './performance/PerformanceTester';
import { ContractTester } from './contract/ContractTester';
import { APITestConfig } from './types/config';

export class APITestingFramework {
  private testClient: TestClient;
  private dataGenerator: TestDataGenerator;
  private reporter: TestReporter;
  private securityTester: SecurityTester;
  private performanceTester: PerformanceTester;
  private contractTester: ContractTester;

  constructor(config: APITestConfig) {
    this.testClient = new TestClient(config);
    this.dataGenerator = new TestDataGenerator(config);
    this.reporter = new TestReporter(config);
    this.securityTester = new SecurityTester(config);
    this.performanceTester = new PerformanceTester(config);
    this.contractTester = new ContractTester(config);
  }

  async runUnitTests(): Promise<void> {
    console.log('Running unit tests...');
    // Implementation for unit tests
  }

  async runIntegrationTests(): Promise<void> {
    console.log('Running integration tests...');
    // Implementation for integration tests
  }

  async runE2ETests(): Promise<void> {
    console.log('Running end-to-end tests...');
    // Implementation for E2E tests
  }

  async runSecurityTests(): Promise<void> {
    console.log('Running security tests...');
    await this.securityTester.runAllTests();
  }

  async runPerformanceTests(): Promise<void> {
    console.log('Running performance tests...');
    await this.performanceTester.runAllTests();
  }

  async runContractTests(): Promise<void> {
    console.log('Running contract tests...');
    await this.contractTester.runAllTests();
  }

  async generateReport(): Promise<void> {
    await this.reporter.generateReport();
  }

  getTestClient(): TestClient {
    return this.testClient;
  }

  getDataGenerator(): TestDataGenerator {
    return this.dataGenerator;
  }
}

export * from './types/config';
export * from './client/TestClient';
export * from './data/TestDataGenerator';
export * from './reporting/TestReporter';
export * from './security/SecurityTester';
export * from './performance/PerformanceTester';
export * from './contract/ContractTester';
