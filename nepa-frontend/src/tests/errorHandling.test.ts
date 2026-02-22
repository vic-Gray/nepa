import { NetworkStatusService, NetworkStatus } from '../services/networkStatusService';
import { ErrorHandler, ErrorType } from '../utils/errorHandler';

describe('Network Error Handling', () => {
  let networkService: NetworkStatusService;

  beforeEach(() => {
    networkService = new NetworkStatusService({
      checkInterval: 1000,
      timeoutThreshold: 2000,
      slowConnectionThreshold: 1000
    });
  });

  afterEach(() => {
    networkService.stopMonitoring();
  });

  describe('Network Status Detection', () => {
    test('should detect offline status', async () => {
      // Mock fetch for testing
      global.fetch = jest.fn();

      // Mock setTimeout for testing
      global.setTimeout = jest.fn((fn, delay) => {
        return setTimeout(fn, delay);
      });

      // Mock fetch to simulate network failure
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      const isOnline = await networkService.checkConnection();
      expect(isOnline).toBe(false);
      expect(networkService.getStatus()).toBe(NetworkStatus.OFFLINE);
    });

    test('should detect slow connection', async () => {
      // Mock fetch to simulate slow response
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 1500))
      );
      
      await networkService.checkConnection();
      expect(networkService.getStatus()).toBe(NetworkStatus.SLOW);
    });

    test('should detect online status', async () => {
      // Mock fetch to simulate successful response
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      
      const isOnline = await networkService.checkConnection();
      expect(isOnline).toBe(true);
      expect(networkService.getStatus()).toBe(NetworkStatus.ONLINE);
    });
  });

  describe('Error Classification', () => {
    test('should classify network errors correctly', () => {
      const networkError = new TypeError('Failed to fetch');
      const classified = ErrorHandler.classifyError(networkError);
      
      expect(classified.type).toBe(ErrorType.NETWORK_ERROR);
      expect(classified.isRetryable).toBe(true);
    });

    test('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      const classified = ErrorHandler.classifyError(timeoutError);
      
      expect(classified.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(classified.isRetryable).toBe(true);
    });

    test('should classify validation errors correctly', () => {
      const validationError = {
        response: {
          status: 400,
          data: { message: 'Invalid input' }
        }
      };
      const classified = ErrorHandler.classifyError(validationError);
      
      expect(classified.type).toBe(ErrorType.VALIDATION_ERROR);
      expect(classified.isRetryable).toBe(false);
    });

    test('should classify server errors correctly', () => {
      const serverError = {
        response: {
          status: 500
        }
      };
      const classified = ErrorHandler.classifyError(serverError);
      
      expect(classified.type).toBe(ErrorType.SERVER_ERROR);
      expect(classified.isRetryable).toBe(true);
    });

    test('should classify rate limit errors correctly', () => {
      const rateLimitError = {
        response: {
          status: 429
        }
      };
      const classified = ErrorHandler.classifyError(rateLimitError);
      
      expect(classified.type).toBe(ErrorType.RATE_LIMIT_ERROR);
      expect(classified.isRetryable).toBe(true);
    });
  });

  describe('Retry Mechanism', () => {
    test('should retry retryable errors', async () => {
      let attemptCount = 0;
      const failingOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return 'success';
      });

      const result = await ErrorHandler.retryWithBackoff(failingOperation, {
        maxRetries: 3,
        baseDelay: 10
      });

      expect(result).toBe('success');
      expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-retryable errors', async () => {
      const failingOperation = jest.fn().mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await expect(
        ErrorHandler.retryWithBackoff(failingOperation, {
          maxRetries: 3,
          baseDelay: 10
        })
      ).rejects.toThrow('Validation failed');

      expect(failingOperation).toHaveBeenCalledTimes(1);
    });

    test('should use exponential backoff', async () => {
      const startTime = Date.now();
      let attemptCount = 0;
      
      const failingOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return 'success';
      });

      await ErrorHandler.retryWithBackoff(failingOperation, {
        maxRetries: 3,
        baseDelay: 100,
        backoffMultiplier: 2
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take approximately 100ms + 200ms = 300ms (plus small jitter)
      expect(duration).toBeGreaterThan(250);
      expect(duration).toBeLessThan(400);
    });
  });

  describe('Error Messages', () => {
    test('should provide user-friendly messages', () => {
      const networkError = ErrorHandler.classifyError(new TypeError('Failed to fetch'));
      const errorMessage = ErrorHandler.getErrorMessage(networkError);
      
      expect(errorMessage.title).toBe('Network Connection Error');
      expect(errorMessage.message).toBe('Unable to connect to the server. Please check your internet connection.');
      expect(errorMessage.action).toBe('Try Again');
    });

    test('should create user-friendly error text', () => {
      const networkError = ErrorHandler.classifyError(new TypeError('Failed to fetch'));
      const userMessage = ErrorHandler.createUserFriendlyMessage(networkError);
      
      expect(userMessage).toContain('Network Connection Error');
      expect(userMessage).toContain('Unable to connect to the server');
      expect(userMessage).toContain('Try Again');
    });
  });

  describe('Network Metrics', () => {
    test('should track network metrics', () => {
      const metrics = networkService.getMetrics();
      
      expect(metrics).toHaveProperty('status');
      expect(metrics).toHaveProperty('lastCheck');
      expect(metrics).toHaveProperty('responseTime');
      expect(metrics).toHaveProperty('consecutiveFailures');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successfulRequests');
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('averageResponseTime');
    });

    test('should update metrics on status change', () => {
      const initialMetrics = networkService.getMetrics();
      
      // Simulate status change
      networkService['setStatus'](NetworkStatus.OFFLINE);
      
      const updatedMetrics = networkService.getMetrics();
      expect(updatedMetrics.status).toBe(NetworkStatus.OFFLINE);
      expect(updatedMetrics.lastCheck).not.toBe(initialMetrics.lastCheck);
    });
  });
});

// Integration test example
describe('Payment Error Handling Integration', () => {
  test('should handle payment failures gracefully', async () => {
    // Mock a payment function that fails
    const mockPayment = jest.fn().mockRejectedValue(new Error('Insufficient funds'));
    
    try {
      await ErrorHandler.retryWithBackoff(mockPayment, {
        maxRetries: 2,
        baseDelay: 100
      });
    } catch (error) {
      const networkError = ErrorHandler.classifyError(error);
      expect(networkError.type).toBe(ErrorType.UNKNOWN_ERROR);
      expect(networkError.isRetryable).toBe(false);
    }
  });

  test('should handle network timeouts during payment', async () => {
    const mockPayment = jest.fn().mockImplementation(() => {
      const error = new Error('Request timeout');
      error.name = 'AbortError';
      throw error;
    });
    
    try {
      await ErrorHandler.retryWithBackoff(mockPayment, {
        maxRetries: 2,
        baseDelay: 100
      });
    } catch (error) {
      const networkError = ErrorHandler.classifyError(error);
      expect(networkError.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(networkError.isRetryable).toBe(true);
    }
  });
});
