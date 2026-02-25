#!/usr/bin/env ts-node

import auditClient from '../databases/clients/auditClient';

/**
 * Quick setup check for the audit system
 */
async function checkAuditSetup() {
  console.log('🔍 Checking Audit System Setup...\n');

  const checks = [
    {
      name: 'Audit Client Initialization',
      check: async () => {
        await auditClient.ensureInitialized();
        return true;
      }
    },
    {
      name: 'Database Connection',
      check: async () => {
        return await auditClient.healthCheck();
      }
    },
    {
      name: 'Audit Log Table Access',
      check: async () => {
        try {
          const count = await auditClient.auditLog?.count();
          return typeof count === 'number';
        } catch (error) {
          return false;
        }
      }
    },
    {
      name: 'Environment Variables',
      check: async () => {
        return !!process.env.AUDIT_DATABASE_URL;
      }
    }
  ];

  let allPassed = true;

  for (const { name, check } of checks) {
    try {
      const result = await check();
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${name}`);
      
      if (!result) {
        allPassed = false;
        
        // Provide specific guidance for each check
        switch (name) {
          case 'Audit Client Initialization':
            console.log('   → Run: npm run audit:generate');
            break;
          case 'Database Connection':
            console.log('   → Run: npm run audit:docker-up');
            console.log('   → Check: npm run audit:docker-logs');
            break;
          case 'Audit Log Table Access':
            console.log('   → Run: npm run audit:migrate');
            break;
          case 'Environment Variables':
            console.log('   → Add AUDIT_DATABASE_URL to your .env file');
            break;
        }
      }
    } catch (error) {
      console.log(`❌ FAIL ${name}`);
      console.log(`   → Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 All checks passed! Audit system is ready to use.');
    console.log('\nNext steps:');
    console.log('- Run: npm run test:audit');
    console.log('- Start your application with audit logging enabled');
  } else {
    console.log('⚠️  Some checks failed. Please fix the issues above.');
    console.log('\nQuick setup commands:');
    console.log('1. npm run audit:docker-up');
    console.log('2. npm run audit:setup');
    console.log('3. npm run check:audit');
  }

  return allPassed;
}

// Run if called directly
if (require.main === module) {
  checkAuditSetup().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('❌ Setup check failed:', error);
    process.exit(1);
  });
}

export { checkAuditSetup };