import { NetworkStatusService, NetworkStatus } from '../services/networkStatusService';
import { ErrorHandler, ErrorType } from '../utils/errorHandler';

// Simple test runner for environments without Jest
class TestRunner {
  private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Error Handling Tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error: any) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error?.message || error}`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
  }

  assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual<T>(actual: T, expected: T, message: string) {
    if (actual !== expected) {
      throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
    }
  }
}

// Mock fetch for testing
const mockFetch = {
  mockImplementation: (impl: () => any) => {
    global.fetch = impl;
  },
  mockRejectedValue: (error: Error) => {
    global.fetch = () => Promise.reject(error);
  },
  mockResolvedValue: (value: any) => {
    global.fetch = () => Promise.resolve(value);
  }
};

// Mock setTimeout for testing
const mockSetTimeout = {
  mockImplementation: (impl: (fn: Function, delay: number) => number) => {
    (global.setTimeout as any) = impl;
  }
};

const test = new TestRunner();

// Network Status Detection Tests
test.test('should detect offline status', async () => {
  const networkService = new NetworkStatusService({
    checkInterval: 1000,
    timeoutThreshold: 2000,
    slowConnectionThreshold: 1000
  });

  // Mock fetch to simulate network failure
  mockFetch.mockRejectedValue(new Error('Network error'));
  
  const isOnline = await networkService.checkConnection();
  test.assertEqual(isOnline, false, 'Should detect offline status');
  test.assertEqual(networkService.getStatus(), NetworkStatus.OFFLINE, 'Status should be OFFLINE');
});

test.test('should detect online status', async () => {
  const networkService = new NetworkStatusService({
    checkInterval: 1000,
    timeoutThreshold: 2000,
    slowConnectionThreshold: 1000
  });

  // Mock fetch to simulate successful response
  mockFetch.mockResolvedValue({ ok: true });
  
  const isOnline = await networkService.checkConnection();
  test.assertEqual(isOnline, true, 'Should detect online status');
  test.assertEqual(networkService.getStatus(), NetworkStatus.ONLINE, 'Status should be ONLINE');
});

// Error Classification Tests
test.test('should classify network errors correctly', () => {
  const networkError = new TypeError('Failed to fetch');
  const classified = ErrorHandler.classifyError(networkError);
  
  test.assertEqual(classified.type, ErrorType.NETWORK_ERROR, 'Should classify as network error');
  test.assert(classified.isRetryable, 'Network errors should be retryable');
});

test.test('should classify timeout errors correctly', () => {
  const timeoutError = new Error('Request timeout');
  timeoutError.name = 'AbortError';
  const classified = ErrorHandler.classifyError(timeoutError);
  
  test.assertEqual(classified.type, ErrorType.TIMEOUT_ERROR, 'Should classify as timeout error');
  test.assert(classified.isRetryable, 'Timeout errors should be retryable');
});

test.test('should classify validation errors correctly', () => {
  const validationError = {
    response: {
      status: 400,
      data: { message: 'Invalid input' }
    }
  };
  const classified = ErrorHandler.classifyError(validationError);
  
  test.assertEqual(classified.type, ErrorType.VALIDATION_ERROR, 'Should classify as validation error');
  test.assert(!classified.isRetryable, 'Validation errors should not be retryable');
});

test.test('should classify server errors correctly', () => {
  const serverError = {
    response: {
      status: 500
    }
  };
  const classified = ErrorHandler.classifyError(serverError);
  
  test.assertEqual(classified.type, ErrorType.SERVER_ERROR, 'Should classify as server error');
  test.assert(classified.isRetryable, 'Server errors should be retryable');
});

// Retry Mechanism Tests
test.test('should retry retryable errors', async () => {
  let attemptCount = 0;
  const failingOperation = async () => {
    attemptCount++;
    if (attemptCount < 3) {
      throw new Error('Network error');
    }
    return 'success';
  };

  const result = await ErrorHandler.retryWithBackoff(failingOperation, {
    maxRetries: 3,
    baseDelay: 10
  });

  test.assertEqual(result, 'success', 'Should succeed after retries');
  test.assertEqual(attemptCount, 3, 'Should attempt 3 times');
});

test.test('should not retry non-retryable errors', async () => {
  let attemptCount = 0;
  const failingOperation = async () => {
    attemptCount++;
    throw new Error('Validation failed');
  };

  try {
    await ErrorHandler.retryWithBackoff(failingOperation, {
      maxRetries: 3,
      baseDelay: 10
    });
    throw new Error('Should have thrown an error');
  } catch (error) {
    test.assertEqual(attemptCount, 1, 'Should only attempt once for non-retryable errors');
  }
});

// Error Message Tests
test.test('should provide user-friendly messages', () => {
  const networkError = ErrorHandler.classifyError(new TypeError('Failed to fetch'));
  const errorMessage = ErrorHandler.getErrorMessage(networkError);
  
  test.assertEqual(errorMessage.title, 'Network Connection Error', 'Should have correct title');
  test.assert(errorMessage.message.includes('Unable to connect'), 'Should have descriptive message');
  test.assertEqual(errorMessage.action, 'Try Again', 'Should have correct action');
});

// Network Metrics Tests
test.test('should track network metrics', () => {
  const networkService = new NetworkStatusService({
    checkInterval: 1000,
    timeoutThreshold: 2000,
    slowConnectionThreshold: 1000
  });

  const metrics = networkService.getMetrics();
  
  test.assert(metrics.status !== undefined, 'Should have status');
  test.assert(metrics.lastCheck !== undefined, 'Should have lastCheck');
  test.assert(metrics.responseTime !== undefined, 'Should have responseTime');
  test.assert(metrics.consecutiveFailures !== undefined, 'Should have consecutiveFailures');
  test.assert(metrics.totalRequests !== undefined, 'Should have totalRequests');
  test.assert(metrics.successfulRequests !== undefined, 'Should have successfulRequests');
  test.assert(metrics.failedRequests !== undefined, 'Should have failedRequests');
  test.assert(metrics.averageResponseTime !== undefined, 'Should have averageResponseTime');
});

// Export for manual testing
export { test, mockFetch, mockSetTimeout };

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  test.run().catch(console.error);
}
