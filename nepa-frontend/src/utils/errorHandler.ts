import { ErrorType } from '../services/networkStatusService';
import type { NetworkError } from '../services/networkStatusService';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

export interface ErrorMessages {
  [key: string]: {
    title: string;
    message: string;
    action?: string;
  };
}

export class ErrorHandler {
  private static defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.SERVER_ERROR
    ]
  };

  private static errorMessages: ErrorMessages = {
    [ErrorType.NETWORK_ERROR]: {
      title: 'Network Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Try Again'
    },
    [ErrorType.TIMEOUT_ERROR]: {
      title: 'Request Timeout',
      message: 'The request took too long to complete. Please try again.',
      action: 'Retry'
    },
    [ErrorType.VALIDATION_ERROR]: {
      title: 'Validation Error',
      message: 'Please check your input and try again.',
      action: 'Fix Input'
    },
    [ErrorType.SERVER_ERROR]: {
      title: 'Server Error',
      message: 'Something went wrong on our end. Please try again later.',
      action: 'Try Again'
    },
    [ErrorType.AUTHENTICATION_ERROR]: {
      title: 'Authentication Error',
      message: 'Please log in to continue.',
      action: 'Log In'
    },
    [ErrorType.RATE_LIMIT_ERROR]: {
      title: 'Too Many Requests',
      message: 'Please wait a moment before trying again.',
      action: 'Wait and Retry'
    },
    [ErrorType.UNKNOWN_ERROR]: {
      title: 'Unexpected Error',
      message: 'An unexpected error occurred. Please try again.',
      action: 'Try Again'
    }
  };

  static classifyError(error: any): NetworkError {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        name: 'NetworkError',
        message: 'Network connection failed',
        type: ErrorType.NETWORK_ERROR,
        isRetryable: true,
        originalError: error
      };
    }

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return {
        name: 'TimeoutError',
        message: 'Request timed out',
        type: ErrorType.TIMEOUT_ERROR,
        isRetryable: true,
        originalError: error
      };
    }

    if (error.response) {
      const statusCode = error.response.status;
      
      if (statusCode >= 400 && statusCode < 500) {
        if (statusCode === 401 || statusCode === 403) {
          return {
            name: 'AuthenticationError',
            message: 'Authentication failed',
            type: ErrorType.AUTHENTICATION_ERROR,
            statusCode,
            isRetryable: false,
            originalError: error
          };
        }
        
        if (statusCode === 429) {
          return {
            name: 'RateLimitError',
            message: 'Rate limit exceeded',
            type: ErrorType.RATE_LIMIT_ERROR,
            statusCode,
            isRetryable: true,
            originalError: error
          };
        }

        return {
          name: 'ValidationError',
          message: error.response.data?.message || 'Invalid request',
          type: ErrorType.VALIDATION_ERROR,
          statusCode,
          isRetryable: false,
          originalError: error
        };
      }
      
      if (statusCode >= 500) {
        return {
          name: 'ServerError',
          message: 'Server error occurred',
          type: ErrorType.SERVER_ERROR,
          statusCode,
          isRetryable: true,
          originalError: error
        };
      }
    }

    return {
      name: 'UnknownError',
      message: error.message || 'An unknown error occurred',
      type: ErrorType.UNKNOWN_ERROR,
      isRetryable: false,
      originalError: error
    };
  }

  static getErrorMessage(error: NetworkError): { title: string; message: string; action?: string } {
    return this.errorMessages[error.type] || this.errorMessages[ErrorType.UNKNOWN_ERROR];
  }

  static isRetryableError(error: NetworkError): boolean {
    return error.isRetryable;
  }

  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: NetworkError;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const networkError = this.classifyError(error);
        lastError = networkError;

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt === finalConfig.maxRetries || !this.isRetryableError(networkError)) {
          throw networkError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
          finalConfig.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;
        await this.sleep(delay + jitter);
      }
    }

    throw lastError!;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static createUserFriendlyMessage(error: NetworkError): string {
    const errorInfo = this.getErrorMessage(error);
    return `${errorInfo.title}: ${errorInfo.message}${errorInfo.action ? ` ${errorInfo.action}` : ''}`;
  }

  static logError(error: NetworkError, context?: any): void {
    console.error('Application Error:', {
      type: error.type,
      message: error.message,
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
      context,
      timestamp: new Date().toISOString(),
      originalError: error.originalError
    });
  }

  // Utility for handling errors in React components
  static handleAsyncError(
    promise: Promise<any>,
    onError: (error: NetworkError) => void
  ): void {
    promise.catch(error => {
      const networkError = this.classifyError(error);
      this.logError(networkError);
      onError(networkError);
    });
  }

  // Utility for wrapping async functions with error handling
  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      onError?: (error: NetworkError) => void;
      retryConfig?: Partial<RetryConfig>;
    } = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        if (options.retryConfig) {
          return await this.retryWithBackoff(() => fn(...args), options.retryConfig);
        }
        return await fn(...args);
      } catch (error) {
        const networkError = this.classifyError(error);
        this.logError(networkError);
        
        if (options.onError) {
          options.onError(networkError);
        }
        
        throw networkError;
      }
    };
  }

  // Utility for creating error boundaries
  static createErrorBoundaryState(error: NetworkError | null = null) {
    return {
      hasError: !!error,
      error,
      errorInfo: error ? this.getErrorMessage(error) : null,
      reset: () => ({ hasError: false, error: null, errorInfo: null })
    };
  }
}

// Custom hook for error handling (if using React)
export const useErrorHandler = () => {
  const handleError = (error: any, context?: any) => {
    const networkError = ErrorHandler.classifyError(error);
    ErrorHandler.logError(networkError, context);
    return networkError;
  };

  const retryOperation = async <T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> => {
    return ErrorHandler.retryWithBackoff(operation, config);
  };

  const getErrorMessage = (error: NetworkError) => {
    return ErrorHandler.getErrorMessage(error);
  };

  return {
    handleError,
    retryOperation,
    getErrorMessage,
    classifyError: ErrorHandler.classifyError
  };
};

// Re-export types for convenience
export { ErrorType } from '../services/networkStatusService';
export type { NetworkError } from '../services/networkStatusService';
