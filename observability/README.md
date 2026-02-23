# Distributed Monitoring and Observability System

Comprehensive observability stack for the NEPA microservices architecture, providing metrics, logs, traces, alerting, and SLA monitoring.

## Architecture Overview

The observability stack consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Promtail**: Log shipping
- **Jaeger**: Distributed tracing
- **Alertmanager**: Alert management and routing
- **OpenTelemetry**: Instrumentation framework

## Quick Start

### 1. Start Observability Stack

```bash
# Start all observability services
docker-compose -f docker-compose.observability.yml up -d

# Verify services are running
docker-compose -f docker-compose.observability.yml ps
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Alertmanager**: http://localhost:9093

### 3. Configure Services

Update your service to include observability:

```typescript
import { OpenTelemetrySetup } from './observability/tracing/OpenTelemetrySetup';
import { createLogger } from './observability/logger/StructuredLogger';
import metricsCollector from './observability/metrics/MetricsCollector';
import TracingMiddleware from './observability/tracing/TracingMiddleware';

// Initialize tracing
const tracing = new OpenTelemetrySetup('user-service');
tracing.start();

// Initialize logger
const logger = createLogger('user-service');

// Add middleware
app.use(TracingMiddleware.middleware());
app.use(metricsCollector.middleware('user-service'));

// Expose metrics endpoint
app.get('/metrics', metricsCollector.getMetricsHandler());
```

## Features

### 1. Structured Logging

```typescript
import { createLogger } from './observability/logger/StructuredLogger';

const logger = createLogger('payment-service');

// Info logging
logger.info('Payment processed', { paymentId, amount });

// Error logging
logger.error('Payment failed', error, { paymentId });

// Audit logging
logger.audit('payment.created', 'payment', { paymentId, userId });

// Performance logging
logger.performance('process-payment', duration, { paymentId });

// Metric logging
logger.metric('payment.amount', amount, { currency: 'USD' });
```

### 2. Distributed Tracing

```typescript
import TracingMiddleware from './observability/tracing/TracingMiddleware';

// Trace database operations
await TracingMiddleware.traceDatabase(
  'findUser',
  'SELECT * FROM users WHERE id = $1',
  async () => await userClient.user.findUnique({ where: { id } })
);

// Trace HTTP calls
await TracingMiddleware.traceHttpCall(
  'POST',
  'https://api.stellar.org/payment',
  async () => await axios.post(url, data)
);

// Trace custom operations
await TracingMiddleware.traceOperation(
  'process-payment',
  async (span) => {
    span.setAttribute('payment.id', paymentId);
    return await processPayment(paymentId);
  }
);
```

### 3. Metrics Collection

```typescript
import metricsCollector from './observability/metrics/MetricsCollector';

// Record payment
metricsCollector.recordPayment('success', 'STELLAR', 'payment-service');

// Record payment duration
metricsCollector.recordPaymentDuration(duration, 'success', 'STELLAR');

// Record bill creation
metricsCollector.recordBillCreated('electricity', 'billing-service');

// Set active users
metricsCollector.setActiveUsers(1250, 'user-service');

// Record database query
metricsCollector.recordDbQuery('SELECT', 'users', duration, 'user-service');

// Record event bus message
metricsCollector.recordEventBusMessage('payment.success', 'published', 'payment-service');

// Record saga execution
metricsCollector.recordSagaExecution('payment-saga', 'success', 'payment-service');
```

### 4. SLA Monitoring

```typescript
import slaMonitor from './observability/monitoring/SLAMonitor';

// Record request
slaMonitor.recordRequest('payment-service', responseTime, success);

// Check SLA
const { met, violations } = slaMonitor.checkSLA('payment-service');

// Get SLA report
const report = slaMonitor.getSLAReport();

// Start monitoring
slaMonitor.startMonitoring(60000); // Check every minute
```

### 5. Anomaly Detection

```typescript
import anomalyDetector from './observability/monitoring/AnomalyDetector';

// Add data point
anomalyDetector.addDataPoint('response_time', responseTime);

// Detect anomaly
const anomaly = anomalyDetector.detectAnomaly('response_time', currentValue);
if (anomaly.isAnomaly) {
  console.log('Anomaly detected:', anomaly.message);
}

// Detect trend
const { trend, slope } = anomalyDetector.detectTrend('error_rate');

// Predict next value
const predicted = anomalyDetector.predictNextValue('request_count', 1);

// Auto-monitor metric
anomalyDetector.monitorMetric(
  'payment_failures',
  async () => await getPaymentFailureCount(),
  60000
);
```

## Alert Rules

Alerts are configured in `observability/config/alert-rules.yml`:

- **Service Health**: Service down, high error rate, high response time
- **Database Health**: Connection pool exhausted, high query time, replication lag
- **Payment Service**: High failure rate, slow processing
- **Resource Usage**: High CPU, high memory, low disk space
- **SLA Monitoring**: Availability violations, response time violations
- **Anomaly Detection**: Unusual traffic patterns, unusual error rates

## Dashboards

Pre-configured Grafana dashboards:

1. **Service Overview**: Overall system health
2. **Service Details**: Per-service metrics
3. **Database Performance**: Database metrics
4. **Payment Analytics**: Payment-specific metrics
5. **SLA Dashboard**: SLA compliance tracking
6. **Error Tracking**: Error rates and patterns

## Environment Variables

```env
# Jaeger
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Prometheus
PROMETHEUS_URL=http://localhost:9090

# Loki
LOKI_URL=http://localhost:3100

# Alertmanager
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_SERVICE_KEY=your-pagerduty-key
SMTP_USERNAME=alerts@nepa.io
SMTP_PASSWORD=your-password

# Service
SERVICE_NAME=user-service
SERVICE_VERSION=1.0.0
LOG_LEVEL=info
```

## Best Practices

1. **Always use structured logging** with correlation IDs
2. **Trace all external calls** (HTTP, database, message queue)
3. **Record business metrics** (payments, bills, users)
4. **Set up alerts** for critical metrics
5. **Monitor SLAs** continuously
6. **Review dashboards** regularly
7. **Investigate anomalies** promptly
8. **Keep logs for 30 days** minimum

## Troubleshooting

### No metrics appearing

```bash
# Check if metrics endpoint is accessible
curl http://localhost:3001/metrics

# Check Prometheus targets
open http://localhost:9090/targets
```

### No traces in Jaeger

```bash
# Check Jaeger health
curl http://localhost:14269/

# Verify JAEGER_ENDPOINT is set correctly
echo $JAEGER_ENDPOINT
```

### Logs not in Loki

```bash
# Check Promtail status
docker logs nepa-promtail

# Verify log file paths in promtail.yml
```

## Maintenance

### Backup Prometheus Data

```bash
# Backup Prometheus data
docker run --rm -v nepa_prometheus-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup.tar.gz /data
```

### Clean Old Logs

```bash
# Clean logs older than 30 days
find ./logs -name "*.log" -mtime +30 -delete
```

### Update Alert Rules

```bash
# Edit alert rules
vim observability/config/alert-rules.yml

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload
```

## Monitoring Checklist

- [ ] All services expose `/metrics` endpoint
- [ ] All services send traces to Jaeger
- [ ] All services use structured logging
- [ ] Alerts configured for critical metrics
- [ ] Dashboards created for key metrics
- [ ] SLA targets defined
- [ ] Anomaly detection enabled
- [ ] Log retention configured
- [ ] Backup strategy in place
- [ ] Team trained on observability tools
