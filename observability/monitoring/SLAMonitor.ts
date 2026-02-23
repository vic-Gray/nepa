// SLA monitoring and tracking
import metricsCollector from '../metrics/MetricsCollector';
import { createLogger } from '../logger/StructuredLogger';

const logger = createLogger('sla-monitor');

export interface SLATarget {
  name: string;
  availability: number; // e.g., 99.9 for 99.9%
  responseTime: number; // in milliseconds
  errorRate: number; // e.g., 0.01 for 1%
}

export interface SLAMetrics {
  availability: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

export class SLAMonitor {
  private targets: Map<string, SLATarget> = new Map();
  private metrics: Map<string, SLAMetrics> = new Map();

  constructor() {
    // Define SLA targets for each service
    this.targets.set('user-service', {
      name: 'User Service',
      availability: 99.9,
      responseTime: 500,
      errorRate: 0.01,
    });

    this.targets.set('payment-service', {
      name: 'Payment Service',
      availability: 99.95,
      responseTime: 2000,
      errorRate: 0.005,
    });

    this.targets.set('billing-service', {
      name: 'Billing Service',
      availability: 99.9,
      responseTime: 1000,
      errorRate: 0.01,
    });

    this.targets.set('notification-service', {
      name: 'Notification Service',
      availability: 99.5,
      responseTime: 3000,
      errorRate: 0.02,
    });
  }

  /**
   * Record request metrics
   */
  recordRequest(
    service: string,
    responseTime: number,
    success: boolean
  ) {
    const current = this.metrics.get(service) || {
      availability: 100,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
    };

    current.totalRequests++;
    if (success) {
      current.successfulRequests++;
    } else {
      current.failedRequests++;
    }

    // Calculate metrics
    current.availability = (current.successfulRequests / current.totalRequests) * 100;
    current.errorRate = current.failedRequests / current.totalRequests;
    current.averageResponseTime = 
      (current.averageResponseTime * (current.totalRequests - 1) + responseTime) / 
      current.totalRequests;

    this.metrics.set(service, current);
  }

  /**
   * Check if SLA is being met
   */
  checkSLA(service: string): {
    met: boolean;
    violations: string[];
  } {
    const target = this.targets.get(service);
    const metrics = this.metrics.get(service);

    if (!target || !metrics) {
      return { met: true, violations: [] };
    }

    const violations: string[] = [];

    // Check availability
    if (metrics.availability < target.availability) {
      violations.push(
        `Availability: ${metrics.availability.toFixed(2)}% (target: ${target.availability}%)`
      );
    }

    // Check response time
    if (metrics.averageResponseTime > target.responseTime) {
      violations.push(
        `Response Time: ${metrics.averageResponseTime.toFixed(0)}ms (target: ${target.responseTime}ms)`
      );
    }

    // Check error rate
    if (metrics.errorRate > target.errorRate) {
      violations.push(
        `Error Rate: ${(metrics.errorRate * 100).toFixed(2)}% (target: ${(target.errorRate * 100).toFixed(2)}%)`
      );
    }

    if (violations.length > 0) {
      logger.warn(`SLA violations detected for ${service}`, {
        service,
        violations,
        metrics,
        target,
      });
    }

    return {
      met: violations.length === 0,
      violations,
    };
  }

  /**
   * Get SLA report for all services
   */
  getSLAReport(): Record<string, {
    target: SLATarget;
    metrics: SLAMetrics;
    status: 'met' | 'violated';
    violations: string[];
  }> {
    const report: Record<string, any> = {};

    for (const [service, target] of this.targets) {
      const metrics = this.metrics.get(service);
      const slaCheck = this.checkSLA(service);

      report[service] = {
        target,
        metrics: metrics || {
          availability: 100,
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          errorRate: 0,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
        },
        status: slaCheck.met ? 'met' : 'violated',
        violations: slaCheck.violations,
      };
    }

    return report;
  }

  /**
   * Reset metrics (for testing or new period)
   */
  resetMetrics(service?: string) {
    if (service) {
      this.metrics.delete(service);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Start periodic SLA checking
   */
  startMonitoring(intervalMs: number = 60000) {
    setInterval(() => {
      const report = this.getSLAReport();
      
      for (const [service, data] of Object.entries(report)) {
        if (data.status === 'violated') {
          logger.error(`SLA violation for ${service}`, {
            service,
            violations: data.violations,
            metrics: data.metrics,
          });
        }
      }
    }, intervalMs);

    logger.info('SLA monitoring started', { intervalMs });
  }
}

export default new SLAMonitor();
