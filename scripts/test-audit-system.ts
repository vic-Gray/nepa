#!/usr/bin/env ts-node

import { auditService, AuditAction, AuditSeverity, AuditStatus } from '../services/AuditService';

/**
 * Test script to verify the audit system is working
 */
async function testAuditSystem() {
  console.log('🔍 Testing Audit System...');

  try {
    // Test 1: Log a simple audit event
    console.log('📝 Test 1: Logging a simple audit event...');
    await auditService.logAudit({
      action: AuditAction.USER_LOGIN,
      resource: 'user',
      resourceId: 'test-user-123',
      description: 'Test user login for audit system verification',
      severity: AuditSeverity.LOW,
      status: AuditStatus.SUCCESS,
      metadata: {
        testRun: true,
        timestamp: new Date().toISOString()
      },
      context: {
        userId: 'test-user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script',
        endpoint: '/test/audit',
        method: 'POST'
      }
    });
    console.log('✅ Test 1 passed: Audit event logged successfully');

    // Test 2: Search audit logs
    console.log('🔍 Test 2: Searching audit logs...');
    const searchResult = await auditService.searchAuditLogs({
      limit: 10,
      offset: 0
    });
    console.log(`✅ Test 2 passed: Found ${searchResult.total} audit logs`);

    // Test 3: Log an event sourcing event
    console.log('📊 Test 3: Logging an event sourcing event...');
    await auditService.logEvent({
      eventType: 'UserLoginTest',
      aggregateId: 'test-user-123',
      aggregateType: 'User',
      eventData: {
        loginTime: new Date(),
        testRun: true
      }
    }, {
      userId: 'test-user-123'
    });
    console.log('✅ Test 3 passed: Event sourcing event logged successfully');

    // Test 4: Get user activity timeline
    console.log('📈 Test 4: Getting user activity timeline...');
    const timeline = await auditService.getUserActivityTimeline('test-user-123');
    console.log(`✅ Test 4 passed: Retrieved ${timeline.length} activities for user`);

    console.log('🎉 All audit system tests passed!');
    console.log('\n📊 Audit System Status:');
    console.log(`- Total audit logs: ${searchResult.total}`);
    console.log(`- User activities: ${timeline.length}`);
    console.log('- Event sourcing: Working');
    console.log('- Search functionality: Working');

  } catch (error) {
    console.error('❌ Audit system test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testAuditSystem().then(() => {
    console.log('✅ Audit system test completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Audit system test failed:', error);
    process.exit(1);
  });
}

export { testAuditSystem };