# Workflow Approval System Guide

This document outlines the approval-based workflows implemented for the NEPA application to ensure proper oversight and security for critical operations.

## Overview

Three approval-based workflows have been created to require manual approval before executing sensitive operations:

1. **Production Deployment** - Requires approval for production deployments
2. **Security Operations** - Requires approval for security-sensitive tasks
3. **Database Operations** - Requires approval for database modifications

## Workflow Details

### 1. Production Deployment Approval

**File:** `.github/workflows/deploy-production-approval.yml`

**Triggers:**
- Manual workflow dispatch
- Requires version, environment, and deployment notes

**Approval Process:**
1. **Pre-deployment checks** - Validates tests, build, and security
2. **Approval request** - Requires manual approval from authorized personnel
3. **Deployment** - Executes deployment with rollback capability
4. **Post-deployment verification** - Ensures system health

**Required Inputs:**
- `version` - Release version (e.g., v1.0.0)
- `environment` - Target environment (production/staging)
- `notes` - Deployment notes or changes

**Environment Protection:**
- Uses GitHub environments for approval gates
- Requires approval from authorized team members
- Automatic rollback on deployment failure

### 2. Security Operations Approval

**File:** `.github/workflows/security-approval.yml`

**Triggers:**
- Manual workflow dispatch
- Requires operation type, severity, and justification

**Approval Process:**
1. **Security validation** - Validates user permissions and justification
2. **Security approval** - Requires approval from security team
3. **Operation execution** - Performs security operation
4. **Reporting** - Creates detailed security report

**Available Operations:**
- `security-scan` - Comprehensive security scanning
- `dependency-update` - Security dependency updates
- `vulnerability-fix` - Apply vulnerability fixes
- `access-review` - Conduct access and permission review

**Required Inputs:**
- `operation` - Type of security operation
- `severity` - Security severity level (critical/high/medium/low)
- `justification` - Detailed justification (min 20 characters)
- `target-branch` - Target branch for changes

**Security Features:**
- User authorization validation
- Automatic PR creation for security changes
- Security artifact upload and retention
- Team notification system

### 3. Database Operations Approval

**File:** `.github/workflows/database-approval.yml`

**Triggers:**
- Manual workflow dispatch
- Requires operation type, environment, and justification

**Approval Process:**
1. **Operation validation** - Validates permissions and requirements
2. **Database approval** - Requires approval from database administrators
3. **Operation execution** - Performs database operation with backup
4. **Verification** - Validates database integrity

**Available Operations:**
- `migration` - Database schema migrations
- `seed-data` - Database seeding operations
- `backup` - Full database backups
- `restore` - Database restore operations
- `schema-update` - Schema updates

**Required Inputs:**
- `operation` - Type of database operation
- `environment` - Target environment (staging/production)
- `backup-required` - Create backup before operation
- `dry-run` - Run in dry-run mode (no changes)
- `justification` - Detailed justification (min 30 characters)

**Safety Features:**
- Automatic backup creation
- Dry-run mode for testing
- Production operation restrictions
- Database verification and health checks

## Setup Requirements

### 1. GitHub Environments

Create the following environments in your GitHub repository:

#### Production Environment
- **Name:** `production`
- **Protection Rules:**
  - Required reviewers: Add production deployment team
  - Wait timer: 5 minutes
  - Restrict deployments to specific branches: main

#### Staging Environment
- **Name:** `staging`
- **Protection Rules:**
  - Required reviewers: Add staging deployment team
  - Wait timer: 2 minutes

#### Security Operations Environment
- **Name:** `security-operations`
- **Protection Rules:**
  - Required reviewers: Add security team members
  - Wait timer: 1 minute

#### Database Operations Environment
- **Name:** `database-operations`
- **Protection Rules:**
  - Required reviewers: Add database administrators
  - Wait timer: 2 minutes

### 2. Required Secrets

Add these secrets to your GitHub repository:

```
# Database connections
DATABASE_URL_STAGING=postgresql://...
DATABASE_URL_PRODUCTION=postgresql://...

# Security scanning tools
SNYK_TOKEN=your_snyk_token

# Deployment credentials
DEPLOY_KEY=your_deployment_ssh_key
DOCKER_REGISTRY_TOKEN=your_docker_token

# Notification services
SLACK_WEBHOOK_URL=your_slack_webhook
```

### 3. Team Permissions

Configure team permissions in GitHub repository settings:

#### Production Deployment Team
- Members: Senior developers, DevOps team
- Permissions: Write access, deployment permissions

#### Security Team
- Members: Security engineers, senior developers
- Permissions: Write access, security operations

#### Database Administrators
- Members: DBAs, backend leads
- Permissions: Write access, database operations

## Usage Instructions

### Running Production Deployment

1. **Navigate to Actions tab** in GitHub repository
2. **Select "Production Deployment (Approval Required)"** workflow
3. **Click "Run workflow"**
4. **Fill in required inputs:**
   - Version: `v1.2.0`
   - Environment: `production`
   - Notes: `Fixed critical security vulnerability and added logging system`
5. **Submit** and wait for approval
6. **Team members will receive approval request**
7. **Once approved**, deployment executes automatically

### Running Security Operations

1. **Go to Actions → Security Operations**
2. **Click "Run workflow"**
3. **Select operation type and severity:**
   - Operation: `vulnerability-fix`
   - Severity: `high`
   - Justification: `Critical CVE-2024-1234 requires immediate patching`
   - Target branch: `main`
4. **Submit** for security team approval
5. **Security team reviews and approves**
6. **Operation executes** with automatic PR creation

### Running Database Operations

1. **Navigate to Database Operations workflow**
2. **Select operation and settings:**
   - Operation: `migration`
   - Environment: `staging`
   - Backup required: `true`
   - Dry run: `true` (for testing)
   - Justification: `Add user_preferences table for new feature`
3. **Submit** for DBA approval
4. **Database administrators review and approve**
5. **Operation executes** with backup and verification

## Safety Features

### Automatic Rollbacks
- Production deployments automatically rollback on failure
- Database operations can be rolled back
- Security operations create revert PRs

### Backup and Recovery
- Database operations create automatic backups
- Artifacts retained for 30 days
- Operation logs stored for audit trail

### Approval Gates
- Multi-level approval system
- Time delays for critical operations
- User authorization validation

### Monitoring and Alerts
- Real-time operation status updates
- Automatic team notifications
- Detailed operation reports

## Best Practices

### 1. Pre-deployment Checks
- Always run in staging first
- Verify all tests pass
- Check security scan results
- Review code changes thoroughly

### 2. Security Operations
- Provide detailed justifications
- Use appropriate severity levels
- Review generated PRs carefully
- Monitor for unexpected behavior

### 3. Database Operations
- Always use dry-run mode first
- Create backups before changes
- Test in staging environment
- Verify data integrity post-operation

### 4. Approval Process
- Only approve operations you understand
- Review all provided justifications
- Check for proper documentation
- Ensure rollback plans exist

## Troubleshooting

### Common Issues

#### Approval Not Working
- Check environment protection rules
- Verify team member permissions
- Ensure required reviewers are added

#### Workflow Failures
- Review workflow logs for errors
- Check secret configuration
- Verify service connections

#### Database Issues
- Check database connection strings
- Verify permissions and access
- Review operation logs

### Getting Help

1. **Check workflow logs** in Actions tab
2. **Review environment settings** in repository settings
3. **Verify team permissions** and member access
4. **Consult operation reports** for detailed information

## Future Enhancements

Potential improvements to consider:

1. **Automated Testing Integration**
   - Integrate with test suites
   - Automated rollback on test failures
   - Performance testing integration

2. **Enhanced Monitoring**
   - Real-time operation dashboards
   - Integration with monitoring tools
   - Automated alerting systems

3. **Advanced Security**
   - Multi-signature approvals
   - Time-based access controls
   - Automated vulnerability scanning

4. **Database Enhancements**
   - Automated backup scheduling
   - Database performance monitoring
   - Multi-environment synchronization

---

## Security Considerations

- **Never commit sensitive data** to repository
- **Use GitHub secrets** for all credentials
- **Regularly rotate** access tokens and keys
- **Monitor approval logs** for unauthorized access
- **Implement least privilege** principle for team permissions

This approval system ensures that critical operations are properly reviewed, documented, and executed safely while maintaining operational efficiency.
