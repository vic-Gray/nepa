# Audit Trail Implementation

## Overview

This document describes the comprehensive audit trail system implemented for the NEPA platform to ensure regulatory compliance, security monitoring, and operational transparency.

## Architecture

### Components

1. **Audit Service** (`services/AuditService.ts`)
   - Central audit logging service
   - Event sourcing integration
   - Compliance reporting
   - Search and filtering capabilities

2. **Audit Database** (`databases/audit-service/`)
   - Dedicated PostgreSQL database for audit logs
   - Immutable audit trail storage
   - Retention policy management
   - Performance-optimized indexes

3. **Audit Middleware** (`middleware/auditMiddleware.ts`)
   - Automatic audit context capture
   - Request/response logging
   - Security event detection
   - Rate limit breach tracking

4. **Audit Controller** (`controllers/AuditController.ts`)
   - REST API for audit log access
   - Compliance report generation
   - Data export capabilities
   - User activity timelines

5. **Event Handlers** (`databases/event-patterns/handlers/auditHandlers.ts`)
   - Domain event audit logging
   - Event sourcing integration
   - Real-time audit trail creation

6. **Cleanup Service** (`services/AuditCleanupService.ts`)
   - Automated log retention
   - Archival management
   - Compliance with data retention policies

## Features

### Audit Actions Tracked

#### User Actions
- `USER_REGISTER` - User registration
- `USER_LOGIN` - User login attempts
- `USER_LOGOUT` - User logout
- `USER_UPDATE_PROFILE` - Profile modifications
- `USER_CHANGE_PASSWORD` - Password changes
- `USER_ENABLE_2FA` / `USER_DISABLE_2FA` - Two-factor authentication changes
- `USER_VERIFY_EMAIL` - Email verification
- `USER_RESET_PASSWORD` - Password reset requests
- `USER_REVOKE_SESSION` - Session revocation
- `USER_UPDATE_WALLET` - Wallet address updates

#### Admin Actions
- `ADMIN_UPDATE_USER_ROLE` - User role modifications
- `ADMIN_SUSPEND_USER` - User account suspension
- `ADMIN_ACTIVATE_USER` - User account activation
- `ADMIN_DELETE_USER` - User account deletion
- `ADMIN_VIEW_USER_DATA` - Access to user data
- `ADMIN_EXPORT_DATA` - Data export operations
- `ADMIN_SYSTEM_CONFIG` - System configuration changes

#### Payment Actions
- `PAYMENT_INITIATE` - Payment initiation
- `PAYMENT_SUCCESS` - Successful payments
- `PAYMENT_FAILED` - Failed payments
- `PAYMENT_RETRY` - Payment retry attempts
- `PAYMENT_REFUND` - Refund processing
- `PAYMENT_CANCEL` - Payment cancellation

#### Billing Actions
- `BILL_CREATE` - Bill creation
- `BILL_UPDATE` - Bill modifications
- `BILL_PAY` - Bill payment
- `BILL_CANCEL` - Bill cancellation
- `COUPON_APPLY` / `COUPON_REMOVE` - Coupon operations

#### Document Actions
- `DOCUMENT_UPLOAD` - File uploads
- `DOCUMENT_DOWNLOAD` - File downloads
- `DOCUMENT_DELETE` - File deletions
- `DOCUMENT_VIEW` - File access

#### Webhook Actions
- `WEBHOOK_CREATE` - Webhook registration
- `WEBHOOK_UPDATE` - Webhook modifications
- `WEBHOOK_DELETE` - Webhook removal
- `WEBHOOK_TRIGGER` - Webhook execution
- `WEBHOOK_RETRY` - Webhook retry attempts

#### System Events
- `RATE_LIMIT_BREACH` - Rate limit violations
- `SECURITY_ALERT` - Security incidents
- `LOGIN_FAILURE` - Failed login attempts
- `ACCOUNT_LOCKOUT` - Account lockouts
- `DATA_EXPORT` - Data export operations
- `SYSTEM_ERROR` - System errors

### Audit Log Structure

```typescript
interface AuditLog {
  id: string;
  correlationId?: string;
  
  // Actor Information
  userId?: string;
  adminId?: string;
  sessionId?: string;
  
  // Action Details
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description?: string;
  
  // Context Information
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  
  // Result Information
  status: AuditStatus; // SUCCESS, FAILURE, PENDING, ERROR
  severity: AuditSeverity; // LOW, MEDIUM, HIGH, CRITICAL
  errorMessage?: string;
  
  // State Information
  beforeState?: any;
  afterState?: any;
  metadata?: any;
  
  // Compliance
  retentionDate?: Date;
  isArchived: boolean;
  
  createdAt: Date;
}
```

### Event Sourcing

The audit system includes event sourcing capabilities for complete state reconstruction:

```typescript
interface AuditEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  eventVersion: number;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  timestamp: Date;
}
```

## API Endpoints

### Search Audit Logs
```
GET /api/audit/logs
```
Query parameters:
- `userId` - Filter by user ID
- `action` - Filter by audit action
- `resource` - Filter by resource type
- `startDate` / `endDate` - Date range filtering
- `severity` - Filter by severity level
- `limit` / `offset` - Pagination

### User Activity Timeline
```
GET /api/audit/users/:userId/timeline
```
Returns chronological user activity with context.

### Generate Compliance Report
```
POST /api/audit/reports/compliance
```
Generates comprehensive compliance reports for various standards (SOC2, PCI DSS, GDPR).

### Export Audit Logs
```
GET /api/audit/export
```
Exports audit logs in JSON or CSV format with filtering options.

### Audit Statistics
```
GET /api/audit/stats
```
Returns audit statistics and metrics for monitoring dashboards.

## Data Retention

### Retention Policies

| Resource Type | Retention Period | Compliance Requirement |
|---------------|------------------|------------------------|
| Payment       | 7 years         | Financial regulations  |
| Bill          | 7 years         | Financial regulations  |
| User          | 1 year          | GDPR compliance        |
| Document      | 3 years         | Business requirements  |
| Webhook       | 90 days         | Operational needs      |
| System        | 180 days        | Security monitoring    |
| Default       | 90 days         | General operations     |

### Automated Cleanup

- **Daily Cleanup**: Removes expired audit logs based on retention policies
- **Weekly Archival**: Archives old logs instead of deletion for compliance
- **Manual Cleanup**: Admin-triggered cleanup with custom parameters

## Security Features

### Immutable Logs
- Audit logs are append-only
- No modification or deletion of active logs
- Cryptographic integrity checks (planned)

### Access Control
- Role-based access to audit data
- Users can only view their own activity
- Admins have full audit access
- Super admins can export and generate reports

### Data Protection
- Sensitive data filtering (passwords, tokens)
- IP address and user agent tracking
- Correlation ID for request tracing
- Encrypted storage (database level)

## Compliance Features

### SOC 2 Compliance
- Complete audit trail of all system access
- User activity monitoring
- Administrative action logging
- Security incident tracking

### PCI DSS Compliance
- Payment transaction logging
- Cardholder data access tracking
- Security event monitoring
- Regular audit log review

### GDPR Compliance
- User data access logging
- Data export/deletion tracking
- Consent management audit
- Right to be forgotten support

## Integration Points

### Event-Driven Architecture
The audit system integrates with the existing event bus:

```typescript
// Automatic audit logging for domain events
eventBus.subscribe('payment.success', auditHandlers['payment.success']);
eventBus.subscribe('user.created', auditHandlers['user.created']);
```

### Middleware Integration
```typescript
// Automatic audit logging for API endpoints
app.use('/api/users', auditAuth(AuditAction.USER_UPDATE_PROFILE));
app.use('/api/payments', auditPayment(AuditAction.PAYMENT_INITIATE));
```

### Service Integration
```typescript
// Manual audit logging in services
await auditService.logAudit({
  action: AuditAction.ADMIN_UPDATE_USER_ROLE,
  resource: 'user',
  resourceId: userId,
  beforeState: { role: oldRole },
  afterState: { role: newRole }
});
```

## Setup Instructions

### 1. Database Setup
```bash
# Start audit database
docker-compose -f docker/docker-compose.audit.yml up -d

# Run setup script
npm run setup:audit-database
```

### 2. Environment Variables
```env
# Audit database connection
AUDIT_DATABASE_URL=postgresql://postgres:password@localhost:5440/nepa_audit

# Redis for audit event queuing (optional)
REDIS_URL=redis://localhost:6379
```

### 3. Generate Prisma Client
```bash
npx prisma generate --schema=./databases/audit-service/schema.prisma
```

### 4. Run Migrations
```bash
npx prisma db push --schema=./databases/audit-service/schema.prisma
```

## Monitoring and Alerting

### Metrics to Monitor
- Audit log volume and growth rate
- Failed audit operations
- High-severity security events
- Compliance report generation
- Database performance metrics

### Alerting Rules
- Critical security events (immediate alert)
- High volume of failed operations
- Audit database connectivity issues
- Retention policy violations
- Unusual user activity patterns

## Performance Considerations

### Database Optimization
- Partitioned tables by date for large volumes
- Optimized indexes for common queries
- Connection pooling for audit database
- Async audit logging to prevent blocking

### Scalability
- Separate audit database for isolation
- Redis queuing for high-volume events
- Batch processing for bulk operations
- Archival to cold storage for old logs

## Future Enhancements

### Planned Features
1. **Real-time Audit Dashboard**
   - Live audit event streaming
   - Security incident visualization
   - User activity heatmaps

2. **Advanced Analytics**
   - Anomaly detection in user behavior
   - Predictive security alerts
   - Compliance trend analysis

3. **Enhanced Security**
   - Cryptographic log signing
   - Blockchain-based audit trail
   - Zero-knowledge audit proofs

4. **Integration Improvements**
   - SIEM system integration
   - Webhook notifications for critical events
   - API for external audit tools

## Troubleshooting

### Common Issues

1. **Audit Database Connection Errors**
   - Check database connectivity
   - Verify environment variables
   - Ensure database is running

2. **High Audit Log Volume**
   - Review retention policies
   - Implement log sampling for high-frequency events
   - Consider archival to external storage

3. **Performance Issues**
   - Monitor database query performance
   - Review index usage
   - Consider read replicas for reporting

4. **Missing Audit Logs**
   - Check event handler registration
   - Verify middleware configuration
   - Review error logs for failed audit operations

### Debug Commands
```bash
# Check audit database health
npm run audit:health-check

# View recent audit logs
npm run audit:logs --limit=100

# Generate test compliance report
npm run audit:test-report

# Manual cleanup (dry run)
npm run audit:cleanup --dry-run
```

## Conclusion

This comprehensive audit trail implementation provides:
- Complete visibility into system operations
- Regulatory compliance capabilities
- Security monitoring and incident response
- Operational transparency and accountability
- Scalable architecture for future growth

The system is designed to be non-intrusive to application performance while providing comprehensive audit coverage for all critical operations.