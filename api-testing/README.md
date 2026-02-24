# Comprehensive API Testing Automation Framework

## Overview

This framework provides comprehensive automated testing for the NEPA platform APIs, including unit tests, integration tests, end-to-end tests, performance tests, security tests, and contract tests.

## Features

- **Multi-layer Testing Strategy**: Unit, Integration, and E2E tests
- **Performance Testing**: Load testing, stress testing, and performance monitoring
- **Security Testing**: Vulnerability scanning, authentication testing, and security headers validation
- **Contract Testing**: Service integration testing and API contract verification
- **Test Data Management**: Automated test data generation and cleanup
- **Comprehensive Reporting**: HTML, JSON, and JUnit format reports
- **CI/CD Integration**: Ready for continuous integration pipelines

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with the following variables:

```env
API_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://test:test@localhost:5432/nepa_test
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
API_TOKEN=
USER_SERVICE_URL=http://localhost:3001
NOTIFICATION_SERVICE_URL=http://localhost:3002
DOCUMENT_SERVICE_URL=http://localhost:3003
UTILITY_SERVICE_URL=http://localhost:3004
PAYMENT_SERVICE_URL=http://localhost:3005
BILLING_SERVICE_URL=http://localhost:3006
ANALYTICS_SERVICE_URL=http://localhost:3007
WEBHOOK_SERVICE_URL=http://localhost:3008
```

## Usage

### Running All Tests

```bash
npm run test:all
```

### Running Specific Test Types

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Performance tests
npm run test:performance

# Security tests
npm run test:security

# Contract tests
npm run test:contract

# Load tests (requires k6)
npm run test:load
```

### Individual Test Scripts

```bash
# Run all tests with health check
npm run test:api-health

# Verify contracts
npm run test:contract-verify

# Security scan
npm run test:security-scan

# Generate test report
npm run test:generate-report
```

## Test Structure

```
api-testing/
├── src/
│   ├── client/           # HTTP client for API requests
│   ├── contract/         # Contract testing
│   ├── data/            # Test data generation
│   ├── performance/     # Performance testing
│   ├── reporting/       # Test reporting
│   ├── security/        # Security testing
│   ├── services/        # Service-specific tests
│   └── types/           # TypeScript type definitions
├── tests/
│   ├── e2e/            # End-to-end tests
│   ├── integration/    # Integration tests
│   ├── load/           # Load testing scripts
│   └── unit/           # Unit tests
├── scripts/            # Utility scripts
└── contracts/          # Contract definitions
```

## Test Reports

Test reports are generated in the `test-reports/` directory:

- **HTML Report**: Interactive visual report
- **JSON Report**: Machine-readable format
- **JUnit Report**: CI/CD integration format

## Performance Testing

Performance tests include:

- Response time analysis
- Concurrent user testing
- Load balancing verification
- Database performance testing
- Memory usage monitoring
- Stress testing

## Security Testing

Security tests cover:

- SQL injection vulnerability scanning
- XSS vulnerability detection
- Authentication bypass testing
- Rate limiting verification
- Security headers validation
- Input validation testing

## Contract Testing

Contract testing ensures:

- API response structure consistency
- Service integration compatibility
- Consumer-provider contract verification
- Breaking change detection

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run API Tests
  run: |
    npm install
    npm run test:ci
```

## Environment Requirements

- Node.js 18+
- PostgreSQL
- Redis
- K6 (for load testing)

## Contributing

1. Add new tests to appropriate directories
2. Follow naming conventions
3. Update documentation
4. Run full test suite before submitting

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and configured
2. **API Health**: Verify API server is accessible
3. **Authentication**: Check API tokens and credentials
4. **Dependencies**: Install all required packages

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run test:all
```

## Metrics and Monitoring

The framework tracks:

- Test execution time
- Success/failure rates
- Performance metrics
- Security vulnerabilities
- Contract violations

## Best Practices

1. Run tests in isolated environments
2. Use consistent test data
3. Clean up after each test
4. Monitor test performance
5. Regular security scans
6. Keep contracts updated

## Support

For issues and questions, please refer to the project documentation or create an issue in the repository.
