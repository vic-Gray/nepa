#!/usr/bin/env ts-node
// Health check script for all database services
import DatabaseHealthCheck from '../databases/monitoring/DatabaseHealthCheck';

async function main() {
  console.log('🏥 Running database health checks...\n');

  const report = await DatabaseHealthCheck.getHealthReport();

  console.log(`Overall Status: ${report.overall.toUpperCase()}`);
  console.log(`Timestamp: ${report.timestamp.toISOString()}\n`);

  console.table(
    report.services.map((s) => ({
      Service: s.service,
      Status: s.status,
      'Response Time (ms)': s.responseTime,
      Error: s.error || '-',
    }))
  );

  // Exit with error code if unhealthy
  if (report.overall === 'unhealthy') {
    console.error('\n❌ System is unhealthy!');
    process.exit(1);
  } else if (report.overall === 'degraded') {
    console.warn('\n⚠️  System is degraded!');
    process.exit(0);
  } else {
    console.log('\n✅ All systems healthy!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Health check failed:', error);
  process.exit(1);
});
