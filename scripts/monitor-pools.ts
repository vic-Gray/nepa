#!/usr/bin/env ts-node
// Monitor database connection pools
import ConnectionPoolMonitor from '../databases/monitoring/ConnectionPoolMonitor';

async function main() {
  const duration = parseInt(process.argv[2]) || 300000; // Default 5 minutes
  const interval = parseInt(process.argv[3]) || 10000; // Default 10 seconds

  console.log(`🔍 Monitoring connection pools for ${duration / 1000} seconds...`);
  console.log(`📊 Reporting interval: ${interval / 1000} seconds\n`);

  // Initial report
  await ConnectionPoolMonitor.logPoolMetrics();

  // Start monitoring
  const timer = ConnectionPoolMonitor.startMonitoring(interval);

  // Stop after duration
  setTimeout(() => {
    clearInterval(timer);
    console.log('\n✅ Monitoring completed');
    process.exit(0);
  }, duration);
}

main().catch((error) => {
  console.error('❌ Monitoring failed:', error);
  process.exit(1);
});
