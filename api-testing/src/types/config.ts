export interface APITestConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
  };
  database?: {
    url: string;
    type: 'postgresql' | 'mysql' | 'mongodb';
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  services: {
    userService: string;
    notificationService: string;
    documentService: string;
    utilityService: string;
    paymentService: string;
    billingService: string;
    analyticsService: string;
    webhookService: string;
  };
  performance?: {
    concurrentUsers?: number;
    duration?: number;
    rampUp?: number;
  };
  security?: {
    enableVulnerabilityScan?: boolean;
    enableRateLimitTest?: boolean;
    enableAuthTest?: boolean;
  };
  contract?: {
    providerName: string;
    consumerName: string;
    pactDirectory?: string;
  };
  reporting?: {
    outputDir?: string;
    format?: 'html' | 'json' | 'junit';
    includeCoverage?: boolean;
  };
}

export interface TestResult {
  success: boolean;
  duration: number;
  error?: string;
  response?: any;
  status?: number;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface TestCase {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  data?: any;
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedResponse?: any;
  timeout?: number;
}

export interface PerformanceTestResult {
  url: string;
  method: string;
  requests: number;
  duration: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: number;
  errorRate: number;
}

export interface SecurityTestResult {
  testType: string;
  vulnerability?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation?: string;
  passed: boolean;
}

export interface ContractTestResult {
  consumer: string;
  provider: string;
  interaction: string;
  success: boolean;
  errors?: string[];
}
