export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SLOW = 'slow',
  UNSTABLE = 'unstable'
}

export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT_ERROR = 'timeout_error',
  SERVER_ERROR = 'server_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface NetworkError extends Error {
  type: ErrorType;
  statusCode?: number;
  isRetryable: boolean;
  originalError?: any;
}

export interface NetworkConfig {
  checkInterval: number;
  timeoutThreshold: number;
  slowConnectionThreshold: number;
  maxRetries: number;
  retryDelay: number;
  retryBackoffMultiplier: number;
}

export interface NetworkMetrics {
  status: NetworkStatus;
  lastCheck: Date;
  responseTime: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
}

export class NetworkStatusService {
  private status: NetworkStatus = NetworkStatus.ONLINE;
  private metrics: NetworkMetrics;
  private config: NetworkConfig;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(status: NetworkStatus) => void> = new Set();

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = {
      checkInterval: 30000, // 30 seconds
      timeoutThreshold: 10000, // 10 seconds
      slowConnectionThreshold: 3000, // 3 seconds
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
      ...config
    };

    this.metrics = {
      status: NetworkStatus.ONLINE,
      lastCheck: new Date(),
      responseTime: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    this.startMonitoring();
  }

  startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkNetworkStatus();
    }, this.config.checkInterval);

    // Listen to browser online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnlineEvent());
      window.addEventListener('offline', () => this.handleOfflineEvent());
    }
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
    }
  }

  private async checkNetworkStatus(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Try to fetch a small resource to check connectivity
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);
      
      // Determine status based on response time
      if (responseTime > this.config.timeoutThreshold) {
        this.setStatus(NetworkStatus.UNSTABLE);
      } else if (responseTime > this.config.slowConnectionThreshold) {
        this.setStatus(NetworkStatus.SLOW);
      } else {
        this.setStatus(NetworkStatus.ONLINE);
      }
      
    } catch (error) {
      this.updateMetrics(0, false);
      this.setStatus(NetworkStatus.OFFLINE);
    }
  }

  private handleOnlineEvent = (): void => {
    this.setStatus(NetworkStatus.ONLINE);
    this.metrics.consecutiveFailures = 0;
  };

  private handleOfflineEvent = (): void => {
    this.setStatus(NetworkStatus.OFFLINE);
  };

  private updateMetrics(responseTime: number, success: boolean): void {
    this.metrics.lastCheck = new Date();
    this.metrics.responseTime = responseTime;
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.consecutiveFailures = 0;
    } else {
      this.metrics.failedRequests++;
      this.metrics.consecutiveFailures++;
    }

    // Calculate average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;
  }

  private setStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.metrics.status = newStatus;
      this.notifyListeners(newStatus);
    }
  }

  private notifyListeners(status: NetworkStatus): void {
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  // Public API
  getStatus(): NetworkStatus {
    return this.status;
  }

  getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  isOnline(): boolean {
    return this.status === NetworkStatus.ONLINE || this.status === NetworkStatus.SLOW;
  }

  isOffline(): boolean {
    return this.status === NetworkStatus.OFFLINE;
  }

  isSlow(): boolean {
    return this.status === NetworkStatus.SLOW || this.status === NetworkStatus.UNSTABLE;
  }

  onStatusChange(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  async checkConnection(): Promise<boolean> {
    await this.checkNetworkStatus();
    return this.isOnline();
  }

  updateConfig(newConfig: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
