// Prometheus metrics collector
import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private register: promClient.Registry;

  // HTTP metrics
  private httpRequestDuration: promClient.Histogram;
  private httpRequestTotal: promClient.Counter;
  private httpRequestSize: promClient.Histogram;
  private httpResponseSize: promClient.Histogram;

  // Business metrics
  private paymentTransactions: promClient.Counter;
  private paymentProcessingDuration: promClient.Histogram;
  private billsCreated: promClient.Counter;
  private activeUsers: promClient.Gauge;

  // Database metrics
  private dbQueryDuration: promClient.Histogram;
  private dbConnectionPool: promClient.Gauge;

  // System metrics
  private eventBusMessages: promClient.Counter;
  private sagaExecutions: promClient.Counter;

  private constructor() {
    this.register = new promClient.Registry();
    
    // Enable default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({ register: this.register });

    // HTTP Request Duration
    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // HTTP Request Total
    this.httpRequestTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service'],
      registers: [this.register],
    });

    // HTTP Request Size
    this.httpRequestSize = new promClient.Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route', 'service'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register],
    });

    // HTTP Response Size
    this.httpResponseSize = new promClient.Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'service'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register],
    });

    // Payment Transactions
    this.paymentTransactions = new promClient.Counter({
      name: 'payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['status', 'method', 'service'],
      registers: [this.register],
    });

    // Payment Processing Duration
    this.paymentProcessingDuration = new promClient.Histogram({
      name: 'payment_processing_duration_seconds',
      help: 'Duration of payment processing in seconds',
      labelNames: ['status', 'method'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });

    // Bills Created
    this.billsCreated = new promClient.Counter({
      name: 'bills_created_total',
      help: 'Total number of bills created',
      labelNames: ['utility_type', 'service'],
      registers: [this.register],
    });

    // Active Users
    this.activeUsers = new promClient.Gauge({
      name: 'active_users',
      help: 'Number of active users',
      labelNames: ['service'],
      registers: [this.register],
    });

    // Database Query Duration
    this.dbQueryDuration = new promClient.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'service'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.register],
    });

    // Database Connection Pool
    this.dbConnectionPool = new promClient.Gauge({
      name: 'db_connection_pool_size',
      help: 'Size of database connection pool',
      labelNames: ['state', 'database', 'service'],
      registers: [this.register],
    });

    // Event Bus Messages
    this.eventBusMessages = new promClient.Counter({
      name: 'event_bus_messages_total',
      help: 'Total number of event bus messages',
      labelNames: ['event_type', 'status', 'service'],
      registers: [this.register],
    });

    // Saga Executions
    this.sagaExecutions = new promClient.Counter({
      name: 'saga_executions_total',
      help: 'Total number of saga executions',
      labelNames: ['saga_name', 'status', 'service'],
      registers: [this.register],
    });
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Express middleware for HTTP metrics
   */
  middleware(serviceName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      // Capture response
      const originalSend = res.send;
      res.send = function (data: any) {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;

        // Record metrics
        MetricsCollector.getInstance().httpRequestDuration.observe(
          { method: req.method, route, status_code: res.statusCode, service: serviceName },
          duration
        );

        MetricsCollector.getInstance().httpRequestTotal.inc({
          method: req.method,
          route,
          status_code: res.statusCode,
          service: serviceName,
        });

        // Request size
        const requestSize = parseInt(req.headers['content-length'] || '0');
        if (requestSize > 0) {
          MetricsCollector.getInstance().httpRequestSize.observe(
            { method: req.method, route, service: serviceName },
            requestSize
          );
        }

        // Response size
        const responseSize = Buffer.byteLength(JSON.stringify(data));
        MetricsCollector.getInstance().httpResponseSize.observe(
          { method: req.method, route, service: serviceName },
          responseSize
        );

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Record payment transaction
   */
  recordPayment(status: 'success' | 'failed' | 'pending', method: string, service: string) {
    this.paymentTransactions.inc({ status, method, service });
  }

  /**
   * Record payment processing duration
   */
  recordPaymentDuration(duration: number, status: string, method: string) {
    this.paymentProcessingDuration.observe({ status, method }, duration);
  }

  /**
   * Record bill creation
   */
  recordBillCreated(utilityType: string, service: string) {
    this.billsCreated.inc({ utility_type: utilityType, service });
  }

  /**
   * Set active users count
   */
  setActiveUsers(count: number, service: string) {
    this.activeUsers.set({ service }, count);
  }

  /**
   * Record database query duration
   */
  recordDbQuery(operation: string, table: string, duration: number, service: string) {
    this.dbQueryDuration.observe({ operation, table, service }, duration);
  }

  /**
   * Set database connection pool size
   */
  setDbConnectionPool(state: 'active' | 'idle', count: number, database: string, service: string) {
    this.dbConnectionPool.set({ state, database, service }, count);
  }

  /**
   * Record event bus message
   */
  recordEventBusMessage(eventType: string, status: 'published' | 'consumed' | 'failed', service: string) {
    this.eventBusMessages.inc({ event_type: eventType, status, service });
  }

  /**
   * Record saga execution
   */
  recordSagaExecution(sagaName: string, status: 'success' | 'failed', service: string) {
    this.sagaExecutions.inc({ saga_name: sagaName, status, service });
  }

  /**
   * Get metrics endpoint handler
   */
  getMetricsHandler() {
    return async (req: Request, res: Response) => {
      res.set('Content-Type', this.register.contentType);
      res.end(await this.register.metrics());
    };
  }

  /**
   * Get registry
   */
  getRegister() {
    return this.register;
  }
}

export default MetricsCollector.getInstance();
