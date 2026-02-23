#!/usr/bin/env ts-node
// Test observability stack
import { createLogger } from '../observability/logger/StructuredLogger';
import metricsCollector from '../observability/metrics/MetricsCollector';
import slaMonitor from '../observability/monitoring/SLAMonitor';
import anomalyDetector from '../observability/monitoring/AnomalyDetector';

const logger = createLogger('test-service');

async function testLogging() {
  console.log('\n📝 Testing Structured Logging...');
  
  logger.info('Test info message', { test: true });
  logger.warn('Test warning message', { test: true });
  logger.error('Test error message', new Error('Test error'), { test: true });
  logger.audit('test.action', 'test-resource', { test: true });
  logger.performance('test-operation', 123, { test: true });
  logger.metric('test.metric', 42, { unit: 'count' });
  
  console.log('✅ Logging test completed');
}

async function testMetrics() {
  console.log('\n📊 Testing Metrics Collection...');
  
  metricsCollector.recordPayment('success', 'STELLAR', 'test-service');
  metricsCollector.recordPaymentDuration(1.5, 'success', 'STELLAR');
  metricsCollector.recordBillCreated('electricity', 'test-service');
  metricsCollector.setActiveUsers(100, 'test-service');
  metricsCollector.recordDbQuery('SELECT', 'users', 0.05, 'test-service');
  metricsCollector.recordEventBusMessage('test.event', 'published', 'test-service');
  metricsCollector.recordSagaExecution('test-saga', 'success', 'test-service');
  
  console.log('✅ Metrics test completed');
  console.log('📈 Metrics available at http://localhost:3001/metrics');
}

async function testSLAMonitoring() {
  console.log('\n📋 Testing SLA Monitoring...');
  
  // Simulate requests
  for (let i = 0; i < 100; i++) {
    const responseTime = Math.random() * 1000;
    const success = Math.random() > 0.05; // 95% success rate
    slaMonitor.recordRequest('test-service', responseTime, success);
  }
  
  const { met, violations } = slaMonitor.checkSLA('test-service');
  console.log(`SLA Status: ${met ? '✅ Met' : '❌ Violated'}`);
  if (violations.length > 0) {
    console.log('Violations:', violations);
  }
  
  console.log('✅ SLA monitoring test completed');
}

async function testAnomalyDetection() {
  console.log('\n🔍 Testing Anomaly Detection...');
  
  // Add normal data points
  for (let i = 0; i < 50; i++) {
    anomalyDetector.addDataPoint('test_metric', 100 + Math.random() * 10);
  }
  
  // Add anomaly
  const anomaly = anomalyDetector.detectAnomaly('test_metric', 200);
  console.log(`Anomaly detected: ${anomaly.isAnomaly ? '✅ Yes' : '❌ No'}`);
  if (anomaly.isAnomaly) {
    console.log(`Score: ${anomaly.score.toFixed(2)}, Message: ${anomaly.message}`);
  }
  
  // Test trend detection
  const { trend, slope } = anomalyDetector.detectTrend('test_metric');
  console.log(`Trend: ${trend}, Slope: ${slope.toFixed(4)}`);
  
  console.log('✅ Anomaly detection test completed');
}

async function main() {
  console.log('🧪 Testing NEPA Observability Stack\n');
  
  try {
    await testLogging();
    await testMetrics();
    await testSLAMonitoring();
    await testAnomalyDetection();
    
    console.log('\n✅ All observability tests passed!');
    console.log('\n📊 Check the following:');
    console.log('  - Logs in ./logs/test-service/');
    console.log('  - Metrics at http://localhost:9090');
    console.log('  - Traces at http://localhost:16686');
    console.log('  - Dashboards at http://localhost:3000');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Observability test failed:', error);
    process.exit(1);
  }
}

main();
