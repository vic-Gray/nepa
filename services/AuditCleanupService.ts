import { auditService, AuditAction, AuditSeverity, AuditStatus } from './AuditService';
import { logger } from './logger';

// Check if node-cron is available
let cron: any;
try {
  cron = require('node-cron');
} catch (error) {
  logger.warn('node-cron not available. Install with: npm install node-cron');
}

/**
 * Service for managing audit log retention and cleanup
 */
export class AuditCleanupService {
  private cleanupJob: cron.ScheduledTask | null = null;
  private archiveJob: cron.ScheduledTask | null = null;

  /**
   * Start the cleanup service with scheduled jobs
   */
  start(): void {
    if (!cron) {
      logger.warn('Cannot start audit cleanup service: node-cron not available');
      return;
    }

    // Run cleanup daily at 2 AM
    this.cleanupJob = cron.schedule('0 2 * * *', async () => {
      await this.performCleanup();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    // Run archival weekly on Sundays at 3 AM
    this.archiveJob = cron.schedule('0 3 * * 0', async () => {
      await this.performArchival();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Audit cleanup service started with scheduled jobs');
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }

    if (this.archiveJob) {
      this.archiveJob.stop();
      this.archiveJob = null;
    }

    logger.info('Audit cleanup service stopped');
  }

  /**
   * Perform cleanup of expired audit logs
   */
  async performCleanup(): Promise<void> {
    try {
      logger.info('Starting audit log cleanup...');
      
      const deletedCount = await auditService.cleanupExpiredLogs();
      
      logger.info(`Audit log cleanup completed. Deleted ${deletedCount} expired logs`);
      
      // Log the cleanup operation itself
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR, // Using existing action since SYSTEM_MAINTENANCE doesn't exist
        resource: 'audit',
        description: `Automated cleanup deleted ${deletedCount} expired audit logs`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        metadata: {
          deletedCount,
          cleanupType: 'expired_logs',
          automated: true
        }
      });

    } catch (error) {
      logger.error('Failed to perform audit log cleanup:', error);
      
      // Log the cleanup failure
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR,
        resource: 'audit',
        description: 'Automated audit log cleanup failed',
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          cleanupType: 'expired_logs',
          automated: true,
          error: error instanceof Error ? error.stack : error
        }
      });
    }
  }

  /**
   * Perform archival of old audit logs
   */
  async performArchival(): Promise<void> {
    try {
      logger.info('Starting audit log archival...');
      
      // Archive logs older than 1 year
      const archivedCount = await auditService.archiveOldLogs(365);
      
      logger.info(`Audit log archival completed. Archived ${archivedCount} old logs`);
      
      // Log the archival operation
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR, // Using existing action
        resource: 'audit',
        description: `Automated archival processed ${archivedCount} old audit logs`,
        severity: AuditSeverity.LOW,
        status: AuditStatus.SUCCESS,
        metadata: {
          archivedCount,
          archivalType: 'old_logs',
          daysOld: 365,
          automated: true
        }
      });

    } catch (error) {
      logger.error('Failed to perform audit log archival:', error);
      
      // Log the archival failure
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR,
        resource: 'audit',
        description: 'Automated audit log archival failed',
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          archivalType: 'old_logs',
          automated: true,
          error: error instanceof Error ? error.stack : error
        }
      });
    }
  }

  /**
   * Perform manual cleanup with custom parameters
   */
  async manualCleanup(options: {
    daysOld?: number;
    resourceTypes?: string[];
    dryRun?: boolean;
  } = {}): Promise<{ deletedCount: number; archivedCount: number }> {
    try {
      logger.info('Starting manual audit log cleanup...', options);
      
      let deletedCount = 0;
      let archivedCount = 0;

      if (options.dryRun) {
        // For dry run, just count what would be affected
        logger.info('Dry run mode - no actual cleanup performed');
        return { deletedCount: 0, archivedCount: 0 };
      }

      // Perform cleanup
      deletedCount = await auditService.cleanupExpiredLogs();
      
      // Perform archival if specified
      if (options.daysOld) {
        archivedCount = await auditService.archiveOldLogs(options.daysOld);
      }

      logger.info(`Manual cleanup completed. Deleted: ${deletedCount}, Archived: ${archivedCount}`);
      
      // Log the manual cleanup operation
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR, // Using existing action
        resource: 'audit',
        description: `Manual cleanup - Deleted: ${deletedCount}, Archived: ${archivedCount}`,
        severity: AuditSeverity.MEDIUM,
        status: AuditStatus.SUCCESS,
        metadata: {
          deletedCount,
          archivedCount,
          cleanupType: 'manual',
          options
        }
      });

      return { deletedCount, archivedCount };

    } catch (error) {
      logger.error('Failed to perform manual audit log cleanup:', error);
      
      // Log the cleanup failure
      await auditService.logAudit({
        action: AuditAction.SYSTEM_ERROR,
        resource: 'audit',
        description: 'Manual audit log cleanup failed',
        severity: AuditSeverity.HIGH,
        status: AuditStatus.FAILURE,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          cleanupType: 'manual',
          options,
          error: error instanceof Error ? error.stack : error
        }
      });

      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    totalLogs: number;
    expiredLogs: number;
    archivedLogs: number;
    oldestLog: Date | null;
    newestLog: Date | null;
  }> {
    try {
      // This would require additional queries to the audit database
      // For now, return basic stats
      const stats = await auditService.searchAuditLogs({
        limit: 1,
        offset: 0
      });

      return {
        totalLogs: stats.total,
        expiredLogs: 0, // Would need custom query
        archivedLogs: 0, // Would need custom query
        oldestLog: null, // Would need custom query
        newestLog: stats.logs.length > 0 ? stats.logs[0].createdAt : null
      };

    } catch (error) {
      logger.error('Failed to get cleanup stats:', error);
      throw error;
    }
  }
}

export const auditCleanupService = new AuditCleanupService();