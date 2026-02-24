import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

async function main() {
  console.log('🔍 Checking API health...');
  
  const isHealthy = await checkAPIHealth();
  if (!isHealthy) {
    console.error('❌ API is not healthy. Please ensure the API is running.');
    process.exit(1);
  }

  console.log('✅ API is healthy');

  console.log('🧪 Running unit tests...');
  try {
    execSync('npm run test:unit', { stdio: 'inherit' });
    console.log('✅ Unit tests passed');
  } catch (error) {
    console.error('❌ Unit tests failed');
    process.exit(1);
  }

  console.log('🔗 Running integration tests...');
  try {
    execSync('npm run test:integration', { stdio: 'inherit' });
    console.log('✅ Integration tests passed');
  } catch (error) {
    console.error('❌ Integration tests failed');
    process.exit(1);
  }

  console.log('🎯 Running end-to-end tests...');
  try {
    execSync('npm run test:e2e', { stdio: 'inherit' });
    console.log('✅ End-to-end tests passed');
  } catch (error) {
    console.error('❌ End-to-end tests failed');
    process.exit(1);
  }

  console.log('🔒 Running security tests...');
  try {
    execSync('npm run test:security', { stdio: 'inherit' });
    console.log('✅ Security tests passed');
  } catch (error) {
    console.error('❌ Security tests failed');
    process.exit(1);
  }

  console.log('⚡ Running performance tests...');
  try {
    execSync('npm run test:performance', { stdio: 'inherit' });
    console.log('✅ Performance tests passed');
  } catch (error) {
    console.error('❌ Performance tests failed');
    process.exit(1);
  }

  console.log('📋 Running contract tests...');
  try {
    execSync('npm run test:contract', { stdio: 'inherit' });
    console.log('✅ Contract tests passed');
  } catch (error) {
    console.error('❌ Contract tests failed');
    process.exit(1);
  }

  console.log('📊 Generating test report...');
  try {
    execSync('npm run test:generate-report', { stdio: 'inherit' });
    console.log('✅ Test report generated');
  } catch (error) {
    console.error('❌ Test report generation failed');
    process.exit(1);
  }

  console.log('🎉 All tests completed successfully!');
}

if (require.main === module) {
  main().catch(console.error);
}

export { checkAPIHealth, main };
