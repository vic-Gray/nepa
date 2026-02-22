# Logging and Monitoring System Implementation Guide

This document outlines the comprehensive logging and monitoring system implemented for the NEPA application.

## Overview

The NEPA application now includes a robust logging and monitoring system with the following features:

- **Structured Logging**: Winston-based logging with correlation IDs
- **Error Tracking**: Sentry integration for production error monitoring
- **Performance Monitoring**: Real-time performance metrics collection
- **User Analytics**: Behavior tracking and usage analytics
- **Health Monitoring**: Application health checks and metrics endpoints

## Architecture

### Core Components

1. **Logger Service** (`services/logger.ts`)
   - Winston-based structured logging
   - Correlation ID tracking for request tracing
   - Multiple log levels and transports
   - Daily log rotation in production

2. **Error Tracking** (`services/errorTracking.ts`)
   - Sentry integration for error capture
   - Transaction tracing
   - User context tracking
   - Custom breadcrumbs and tags

3. **Performance Monitoring** (`services/performanceMonitoring.ts`)
   - Request timing and metrics
   - Memory and CPU usage tracking
   - Database performance monitoring
   - Custom metrics collection

4. **Analytics Service** (`services/analytics.ts`)
   - User behavior tracking
   - Session management
   - Event aggregation
   - Conversion and error rate analysis

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Logging and Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://your-sentry-dsn-here
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENVIRONMENT=development

# Performance Monitoring
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_RETENTION_HOURS=24

# Analytics Configuration
ENABLE_ANALYTICS=true
ANALYTICS_RETENTION_DAYS=30
ANALYTICS_BATCH_SIZE=100
```

### Package Dependencies

The following packages have been added:

```json
{
  "winston": "^3.11.0",
  "winston-daily-rotate-file": "^4.7.1",
  "@sentry/node": "^7.77.0",
  "@sentry/tracing": "^7.77.0",
  "cls-rtracer": "^2.6.0",
  "performance-now": "^2.1.0"
}
```

## Usage

### Basic Logging

```typescript
import { logger } from './services/logger';

// Basic logging
logger.info('User logged in', { userId: '123', ip: '192.168.1.1' });
logger.error('Database connection failed', { error: err });
logger.warn('Rate limit exceeded', { userId: '123', endpoint: '/api/auth/login' });
```

### Error Tracking

```typescript
import { errorTracker } from './services/errorTracking';

// Capture exceptions
const eventId = errorTracker.captureException(error, {
  userId: '123',
  action: 'payment_process'
});

// Set user context
errorTracker.setUser({ id: '123', email: 'user@example.com' });

// Add custom tags
errorTracker.setTag('feature', 'payments');
errorTracker.setExtra('paymentAmount', 100.00);
```

### Performance Monitoring

```typescript
import { performanceMonitor } from './services/performanceMonitoring';

// Manual timing
const timerId = performanceMonitor.startTimer('custom_operation');
// ... perform operation
const duration = performanceMonitor.endTimer(timerId);

// Record custom metrics
performanceMonitor.recordCustomMetric('database_connections', 5, 'count');

// Get health status
const health = performanceMonitor.getHealthStatus();
```

### Analytics Tracking

```typescript
import { analyticsService } from './services/analytics';

// Track user events
analyticsService.trackPageView('/dashboard', userId);
analyticsService.trackClick('submit_button', userId);
analyticsService.trackFormSubmit('registration', true, userId);
analyticsService.trackLogin(userId, 'email', true);
analyticsService.trackPurchase(100.00, 'USD', 'product_123', userId);

// Get analytics data
const analytics = analyticsService.getAnalyticsData();
```

## Middleware Integration

The logging system is automatically integrated into the Express application through middleware:

```typescript
// Applied in app.ts
app.use(...loggingMiddleware);
```

This middleware stack includes:
- Correlation ID assignment
- Request/response logging
- Performance tracking
- Analytics collection
- Sentry transaction tracing

## Endpoints

### Health Check

`GET /health`

Returns application health status including:
- Performance metrics
- Memory usage
- Analytics summary
- Uptime information

### Monitoring Metrics

`GET /api/monitoring/metrics` (Requires API key)

Returns detailed monitoring data:
- Analytics data
- Performance metrics
- Recent request metrics
- Custom metrics

## Log Formats

### Development

In development, logs are formatted for readability:

```
2024-01-15T10:30:45.123Z [info] [abc123]: User logged in [user:123 ip:192.168.1.1] {
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User logged in",
  "correlationId": "abc123",
  "userId": "123",
  "ip": "192.168.1.1"
}
```

### Production

In production, logs are written as JSON to rotating files:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "message": "User logged in",
  "correlationId": "abc123",
  "userId": "123",
  "ip": "192.168.1.1"
}
```

## File Structure

```
nepa/
├── services/
│   ├── logger.ts              # Core logging service
│   ├── errorTracking.ts       # Sentry integration
│   ├── performanceMonitoring.ts # Performance metrics
│   └── analytics.ts           # User analytics
├── middleware/
│   └── logger.ts              # Express middleware
├── logs/                      # Log files (production)
│   ├── application-2024-01-15.log
│   └── error-2024-01-15.log
└── app.ts                     # Application with integrated logging
```

## Best Practices

### 1. Use Structured Logging

Always include relevant context in log messages:

```typescript
// Good
logger.info('Payment processed', { 
  userId, 
  amount, 
  currency, 
  paymentId,
  correlationId 
});

// Bad
logger.info(`Payment processed for user ${userId}`);
```

### 2. Set User Context

Always set user context in error tracking:

```typescript
errorTracker.setUser({ 
  id: user.id, 
  email: user.email,
  username: user.username 
});
```

### 3. Monitor Performance

Track critical operations:

```typescript
const timerId = performanceMonitor.startTimer('database_query');
try {
  const result = await database.query(sql);
  performanceMonitor.endTimer(timerId);
  return result;
} catch (error) {
  performanceMonitor.endTimer(timerId);
  throw error;
}
```

### 4. Track User Behavior

Log meaningful user interactions:

```typescript
analyticsService.trackFormSubmit('checkout', success, userId, {
  totalAmount: cart.total,
  itemCount: cart.items.length
});
```

## Troubleshooting

### Logs Not Appearing

1. Check log level configuration
2. Verify file permissions for log directory
3. Ensure Winston transports are properly configured

### Sentry Not Working

1. Verify SENTRY_DSN is correctly set
2. Check network connectivity to Sentry
3. Review Sentry configuration

### Performance Issues

1. Monitor memory usage via `/health` endpoint
2. Check log file sizes and rotation
3. Review performance metrics for bottlenecks

## Migration from Old System

The old `logger.ts` file has been replaced with the comprehensive logging system. Key changes:

1. **Import path**: Now use `services/logger` instead of root `logger`
2. **Enhanced features**: Added correlation IDs, structured logging, and multiple transports
3. **Error handling**: Integrated with Sentry for production error tracking
4. **Performance**: Added timing and metrics collection

Update existing code:

```typescript
// Old
import { requestLogger } from './logger';

// New
import { logger, correlationIdMiddleware } from './services/logger';
```

## Security Considerations

1. **Sensitive Data**: Never log passwords, tokens, or PII
2. **Log Access**: Secure log files with appropriate permissions
3. **Data Retention**: Implement log rotation and cleanup policies
4. **Sentry**: Configure appropriate data scrubbing rules

## Performance Impact

The logging system is designed for minimal performance impact:

- Asynchronous log writing
- Efficient correlation ID tracking
- Minimal overhead in development
- Optimized for production workloads

## Future Enhancements

Potential improvements to consider:

1. **Log Aggregation**: Integration with ELK stack or similar
2. **Metrics Dashboard**: Custom dashboard for monitoring metrics
3. **Alerting**: Automated alerts for critical errors
4. **Distributed Tracing**: Integration with Jaeger or Zipkin
5. **Advanced Analytics**: Machine learning for anomaly detection
