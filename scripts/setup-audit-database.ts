#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Simple logger for setup script
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  error: (msg: string, error?: any) => {
    console.error(`[ERROR] ${msg}`);
    if (error) console.error(error);
  }
};

/**
 * Setup script for the audit database
 */
async function setupAuditDatabase() {
  try {
    logger.info('Setting up audit database...');

    // Ensure directories exist
    const auditServiceDir = join(__dirname, '../databases/audit-service');
    if (!existsSync(auditServiceDir)) {
      mkdirSync(auditServiceDir, { recursive: true });
    }

    // Generate Prisma client for audit service
    logger.info('Generating Prisma client for audit service...');
    execSync('npx prisma generate --schema=./databases/audit-service/schema.prisma', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Run database migrations
    logger.info('Running audit database migrations...');
    execSync('npx prisma db push --schema=./databases/audit-service/schema.prisma', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: process.env.AUDIT_DATABASE_URL || 'postgresql://postgres:password@localhost:5440/nepa_audit'
      }
    });

    // Seed default retention policies
    logger.info('Seeding default retention policies...');
    await seedDefaultRetentionPolicies();

    logger.info('Audit database setup completed successfully!');

  } catch (error) {
    logger.error('Failed to setup audit database:', error);
    process.exit(1);
  }
}

async function seedDefaultRetentionPolicies() {
  try {
    // Import audit client after Prisma generation
    const { default: auditClient } = await import('../databases/clients/auditClient');
    
    const defaultPolicies = [
      { resourceType: 'user', retentionDays: 365 },
      { resourceType: 'payment', retentionDays: 2555 }, // 7 years for financial records
      { resourceType: 'bill', retentionDays: 2555 },
      { resourceType: 'document', retentionDays: 1095 }, // 3 years
      { resourceType: 'webhook', retentionDays: 90 },
      { resourceType: 'system', retentionDays: 180 },
      { resourceType: 'audit', retentionDays: 365 },
      { resourceType: 'default', retentionDays: 90 }
    ];

    for (const policy of defaultPolicies) {
      await auditClient.auditRetentionPolicy.upsert({
        where: { resourceType: policy.resourceType },
        update: { retentionDays: policy.retentionDays },
        create: policy
      });
    }

    logger.info('Default retention policies seeded successfully');

  } catch (error) {
    logger.error('Failed to seed retention policies:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupAuditDatabase();
}

export { setupAuditDatabase };