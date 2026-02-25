# Audit System Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install node-cron cls-rtracer uuid
```

### 2. Start Audit Database
```bash
# Start the audit database container
npm run audit:docker-up

# Wait for database to be ready (check logs)
npm run audit:docker-logs
```

### 3. Setup Audit System
```bash
# Generate Prisma client and run migrations
npm run audit:setup
```

### 4. Verify Setup
```bash
# Check audit system setup
npm run check:audit

# Test the system
npm run test:audit
```

## Environment Variables

Add these to your `.env` file:

```env
# Audit Database
AUDIT_DATABASE_URL=postgresql://postgres:password@localhost:5440/nepa_audit

# Optional: Redis for audit event queuing
REDIS_URL=redis://localhost:6379

# Optional: Enable correlation ID tracking
ENABLE_CORRELATION_ID=true
```

## Manual Setup Steps

### 1. Database Setup

```bash
# Start audit database
docker-compose -f docker/docker-compose.audit.yml up -d

# Check database health
npm run audit:health
```

### 2. Generate Prisma Client

```bash
# Generate the audit Prisma client
npm run audit:generate

# Run database migrations
npm run audit:migrate
```

### 3. Verify Setup

```bash
# Check audit database connection
npm run audit:health

# View audit statistics
npm run audit:stats

# Test the audit system
ts-node scripts/test-audit-system.ts
```

## Usage Examples

### Basic Audit Logging

```typescript
import { auditService, AuditAction, AuditSeverity } from './services/AuditService';

// Log a user action
await auditService.logAudit({
  action: AuditAction.USER_LOGIN,
  resource: 'user',
  resourceId: userId,
  description: 'User logged in successfully',
  severity: AuditSeverity.MEDIUM,
  context: {
    userId,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  }
});
```

### Using Audit Middleware

```typescript
import { auditAuth, auditAdmin } from './middleware/auditMiddleware';

// Automatically audit authentication
app.post('/api/auth/login', auditAuth(AuditAction.USER_LOGIN), loginHandler);

// Automatically audit admin operations
app.put('/api/admin/users/:id/role', 
  auditAdmin(AuditAction.ADMIN_UPDATE_USER_ROLE), 
  updateUserRoleHandler
);
```

### Searching Audit Logs

```typescript
// Search audit logs with filters
const result = await auditService.searchAuditLogs({
  userId: 'user-123',
  action: AuditAction.USER_LOGIN,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  limit: 100
});

console.log(`Found ${result.total} audit logs`);
```

### Generating Compliance Reports

```typescript
// Generate SOC2 compliance report
const report = await auditService.generateComplianceReport({
  reportType: 'SOC2',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  includeUserActions: true,
  includeAdminActions: true,
  includeSystemEvents: true
}, adminUserId);

console.log(`Report generated with ${report.reportData.totalEvents} events`);
```

## API Endpoints

### Search Audit Logs
```http
GET /api/audit/logs?userId=123&action=USER_LOGIN&limit=100
Authorization: Bearer <admin-token>
```

### User Activity Timeline
```http
GET /api/audit/users/123/timeline?startDate=2024-01-01
Authorization: Bearer <token>
```

### Generate Compliance Report
```http
POST /api/audit/reports/compliance
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reportType": "SOC2",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "includeUserActions": true,
  "includeAdminActions": true
}
```

### Export Audit Logs
```http
GET /api/audit/export?format=csv&startDate=2024-01-01
Authorization: Bearer <admin-token>
```

## Maintenance

### Cleanup Commands

```bash
# Manual cleanup of expired logs
npm run audit:cleanup

# Archive old logs (older than 1 year)
npm run audit:archive

# Check cleanup statistics
npm run audit:stats
```

### Monitoring

```bash
# Check audit database health
npm run audit:health

# View recent audit logs
npm run audit:logs

# Monitor audit database
npm run audit:docker-logs
```

## Troubleshooting

### Common Issues

1. **"Audit Prisma client not available"**
   ```bash
   # Generate the Prisma client
   npm run audit:generate
   ```

2. **Database connection errors**
   ```bash
   # Check if database is running
   npm run audit:docker-up
   
   # Check database logs
   npm run audit:docker-logs
   
   # Verify connection
   npm run audit:health
   ```

3. **Missing audit logs**
   ```bash
   # Check if audit middleware is applied
   # Verify audit service is initialized
   # Check application logs for errors
   ```

4. **Performance issues**
   ```bash
   # Check database performance
   # Review retention policies
   # Consider archiving old logs
   npm run audit:archive
   ```

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

### Health Checks

```bash
# Quick health check
npm run audit:health

# Detailed system check
ts-node scripts/test-audit-system.ts
```

## Security Considerations

1. **Access Control**: Only admins can access full audit logs
2. **Data Protection**: Sensitive data is filtered from logs
3. **Retention**: Automatic cleanup based on retention policies
4. **Immutability**: Audit logs cannot be modified once created
5. **Encryption**: Database-level encryption recommended

## Compliance Features

- **SOC 2**: Complete audit trail of system access
- **PCI DSS**: Payment transaction logging
- **GDPR**: User data access tracking
- **HIPAA**: Healthcare data audit trails

## Performance Optimization

1. **Indexes**: Optimized database indexes for common queries
2. **Partitioning**: Consider table partitioning for large volumes
3. **Archival**: Automatic archival of old logs
4. **Async Logging**: Non-blocking audit log writes
5. **Connection Pooling**: Dedicated connection pool for audit database

## Backup and Recovery

```bash
# Backup audit database
docker exec nepa-audit-db pg_dump -U postgres nepa_audit > audit_backup.sql

# Restore audit database
docker exec -i nepa-audit-db psql -U postgres nepa_audit < audit_backup.sql
```

## Integration with Existing Systems

The audit system integrates seamlessly with:
- Authentication system
- Event-driven architecture
- Rate limiting
- Security monitoring
- Compliance reporting

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Run the test script: `ts-node scripts/test-audit-system.ts`
4. Check database connectivity: `npm run audit:health`