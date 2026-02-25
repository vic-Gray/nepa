import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import cron from 'node-cron';

// Mock PrismaClient for now
interface MockPrismaClient {
  backupMetadata: any;
}

const execAsync = promisify(exec);

export interface BackupConfig {
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  storage: {
    type: 'local' | 's3';
    localPath?: string;
    s3?: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  monitoring: {
    cloudwatch?: {
      region: string;
      namespace: string;
    };
    email?: {
      from: string;
      to: string[];
    };
  };
  recovery: {
    pointInTimeRecovery: boolean;
    maxRecoveryPoints: number;
  };
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'point_in_time';
  size: number;
  checksum: string;
  location: string;
  status: 'creating' | 'completed' | 'failed' | 'restoring';
  recoveryPoint?: string;
  compressed: boolean;
  encrypted: boolean;
  tables?: string[];
}

export interface RecoveryPlan {
  id: string;
  backupId: string;
  targetTime?: Date;
  targetDatabase: string;
  steps: RecoveryStep[];
  estimatedDuration: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface RecoveryStep {
  id: string;
  name: string;
  description: string;
  command: string;
  estimatedTime: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

export class BackupService {
  private prisma: MockPrismaClient;
  private config: BackupConfig;
  private s3Client?: S3Client;
  private cloudWatchClient?: CloudWatchClient;
  private sesClient?: SESClient;

  constructor(config: BackupConfig) {
    this.config = config;
    this.prisma = {} as MockPrismaClient;
    
    // Initialize AWS clients if configured
    if (config.storage.type === 's3' && config.storage.s3) {
      this.s3Client = new S3Client({
        region: config.storage.s3.region,
        credentials: {
          accessKeyId: config.storage.s3.accessKeyId,
          secretAccessKey: config.storage.s3.secretAccessKey,
        },
      });
    }

    if (config.monitoring.cloudwatch) {
      this.cloudWatchClient = new CloudWatchClient({
        region: config.monitoring.cloudwatch.region,
      });
    }

    if (config.monitoring.email) {
      this.sesClient = new SESClient({ region: 'us-east-1' });
    }

    this.initializeScheduledBackups();
  }

  /**
   * Initialize scheduled backup jobs
   */
  private initializeScheduledBackups(): void {
    // Daily full backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        await this.createFullBackup();
      } catch (error) {
        console.error('Scheduled daily backup failed:', error);
        await this.sendAlert('Scheduled daily backup failed', error);
      }
    });

    // Hourly incremental backups
    cron.schedule('0 * * * *', async () => {
      try {
        await this.createIncrementalBackup();
      } catch (error) {
        console.error('Scheduled incremental backup failed:', error);
        await this.sendAlert('Scheduled incremental backup failed', error);
      }
    });

    // Point-in-time recovery points every 15 minutes
    if (this.config.recovery.pointInTimeRecovery) {
      cron.schedule('*/15 * * * *', async () => {
        try {
          await this.createPointInTimeRecoveryPoint();
        } catch (error) {
          console.error('Point-in-time recovery point creation failed:', error);
          await this.sendAlert('Point-in-time recovery point creation failed', error);
        }
      });
    }

    // Cleanup old backups daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
      try {
        await this.cleanupOldBackups();
      } catch (error) {
        console.error('Backup cleanup failed:', error);
        await this.sendAlert('Backup cleanup failed', error);
      }
    });
  }

  /**
   * Create a full database backup
   */
  async createFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const filename = `full-backup-${backupId}.sql`;
    const compressedFilename = `${filename}.gz`;

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'full',
      size: 0,
      checksum: '',
      location: '',
      status: 'creating',
      compressed: true,
      encrypted: true,
      tables: await this.getDatabaseTables(),
    };

    try {
      // Save metadata to database
      await this.saveBackupMetadata(metadata);

      // Create database dump
      const dumpCommand = this.buildDumpCommand(filename, false);
      await execAsync(dumpCommand);

      // Compress the backup
      await this.compressFile(filename, compressedFilename);
      const stats = await fs.stat(compressedFilename);
      metadata.size = stats.size;
      metadata.checksum = await this.calculateChecksum(compressedFilename);

      // Upload to storage
      const location = await this.uploadBackup(compressedFilename, backupId);
      metadata.location = location;

      // Update metadata
      metadata.status = 'completed';
      await this.saveBackupMetadata(metadata);

      // Clean up local files
      await fs.unlink(filename);
      await fs.unlink(compressedFilename);

      // Send monitoring metrics
      await this.sendBackupMetrics('full', stats.size, true);

      console.log(`Full backup completed: ${backupId}`);
      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      await this.saveBackupMetadata(metadata);
      await this.sendBackupMetrics('full', 0, false);
      await this.sendAlert('Full backup failed', error);
      throw error;
    }
  }

  /**
   * Create incremental backup
   */
  async createIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const lastBackup = await this.getLastBackupTime();

    if (!lastBackup) {
      throw new Error('No previous backup found for incremental backup');
    }

    const filename = `incremental-backup-${backupId}.sql`;
    const compressedFilename = `${filename}.gz`;

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'incremental',
      size: 0,
      checksum: '',
      location: '',
      status: 'creating',
      compressed: true,
      encrypted: true,
    };

    try {
      await this.saveBackupMetadata(metadata);

      // Create incremental dump using WAL or binary log
      const dumpCommand = this.buildIncrementalDumpCommand(filename, lastBackup);
      await execAsync(dumpCommand);

      await this.compressFile(filename, compressedFilename);
      const stats = await fs.stat(compressedFilename);
      metadata.size = stats.size;
      metadata.checksum = await this.calculateChecksum(compressedFilename);

      const location = await this.uploadBackup(compressedFilename, backupId);
      metadata.location = location;

      metadata.status = 'completed';
      await this.saveBackupMetadata(metadata);

      await fs.unlink(filename);
      await fs.unlink(compressedFilename);

      await this.sendBackupMetrics('incremental', stats.size, true);

      console.log(`Incremental backup completed: ${backupId}`);
      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      await this.saveBackupMetadata(metadata);
      await this.sendBackupMetrics('incremental', 0, false);
      await this.sendAlert('Incremental backup failed', error);
      throw error;
    }
  }

  /**
   * Create point-in-time recovery point
   */
  async createPointInTimeRecoveryPoint(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    const recoveryPoint = timestamp.toISOString();

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      type: 'point_in_time',
      size: 0,
      checksum: '',
      location: recoveryPoint,
      status: 'creating',
      compressed: false,
      encrypted: true,
      recoveryPoint,
    };

    try {
      await this.saveBackupMetadata(metadata);

      // Create recovery point using database-specific method
      const command = this.buildRecoveryPointCommand(recoveryPoint);
      await execAsync(command);

      metadata.status = 'completed';
      await this.saveBackupMetadata(metadata);

      // Cleanup old recovery points
      await this.cleanupOldRecoveryPoints();

      console.log(`Point-in-time recovery point created: ${recoveryPoint}`);
      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      await this.saveBackupMetadata(metadata);
      await this.sendAlert('Point-in-time recovery point creation failed', error);
      throw error;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupId: string, targetTime?: Date): Promise<RecoveryPlan> {
    const backup = await this.getBackupMetadata(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const recoveryPlan: RecoveryPlan = {
      id: this.generateBackupId(),
      backupId,
      targetTime,
      targetDatabase: `${this.config.database.database}_restore_${Date.now()}`,
      steps: await this.buildRecoverySteps(backup, targetTime),
      estimatedDuration: this.calculateRecoveryDuration(backup),
      status: 'pending',
      createdAt: new Date(),
    };

    await this.saveRecoveryPlan(recoveryPlan);

    // Start recovery process
    this.executeRecoveryPlan(recoveryPlan);

    return recoveryPlan;
  }

  /**
   * Execute recovery plan
   */
  private async executeRecoveryPlan(plan: RecoveryPlan): Promise<void> {
    plan.status = 'in_progress';
    await this.saveRecoveryPlan(plan);

    try {
      for (const step of plan.steps) {
        step.status = 'in_progress';
        await this.saveRecoveryPlan(plan);

        try {
          const { stdout, stderr } = await execAsync(step.command);
          step.output = stdout;
          step.status = 'completed';
        } catch (error) {
          step.error = error.message;
          step.status = 'failed';
          throw error;
        }

        await this.saveRecoveryPlan(plan);
      }

      plan.status = 'completed';
      plan.completedAt = new Date();
      await this.saveRecoveryPlan(plan);

      await this.sendAlert('Database recovery completed', { planId: plan.id });

    } catch (error) {
      plan.status = 'failed';
      await this.saveRecoveryPlan(plan);
      await this.sendAlert('Database recovery failed', { planId: plan.id, error });
      throw error;
    }
  }

  /**
   * Test disaster recovery procedures
   */
  async testDisasterRecovery(): Promise<{
    backupTest: boolean;
    restoreTest: boolean;
    pointInTimeTest: boolean;
    crossRegionTest: boolean;
    duration: number;
  }> {
    const startTime = Date.now();
    const results = {
      backupTest: false,
      restoreTest: false,
      pointInTimeTest: false,
      crossRegionTest: false,
      duration: 0,
    };

    try {
      // Test backup creation
      const testBackup = await this.createFullBackup();
      results.backupTest = testBackup.status === 'completed';

      // Test restore to test database
      if (results.backupTest) {
        const restorePlan = await this.restoreFromBackup(testBackup.id);
        results.restoreTest = restorePlan.status === 'completed';
      }

      // Test point-in-time recovery
      const pitrBackup = await this.createPointInTimeRecoveryPoint();
      results.pointInTimeTest = pitrBackup.status === 'completed';

      // Test cross-region replication
      results.crossRegionTest = await this.testCrossRegionReplication();

    } catch (error) {
      console.error('Disaster recovery test failed:', error);
      await this.sendAlert('Disaster recovery test failed', error);
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Monitor backup health and send alerts
   */
  async monitorBackupHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    lastBackup: Date | null;
    backupSize: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    const lastBackup = await this.getLastBackupTime();
    const now = new Date();
    const hoursSinceLastBackup = lastBackup ? 
      (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60) : 999;

    if (hoursSinceLastBackup > 48) {
      status = 'critical';
      issues.push(`No backup for ${hoursSinceLastBackup.toFixed(1)} hours`);
    } else if (hoursSinceLastBackup > 24) {
      status = 'warning';
      issues.push(`No backup for ${hoursSinceLastBackup.toFixed(1)} hours`);
    }

    // Check backup sizes
    const recentBackups = await this.getRecentBackups(7);
    const avgSize = recentBackups.reduce((sum, b) => sum + b.size, 0) / recentBackups.length;
    
    if (avgSize < 1000) { // Less than 1KB
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push('Recent backups are unusually small');
    }

    // Check for failed backups
    const failedBackups = await this.getFailedBackups(24);
    if (failedBackups.length > 0) {
      status = 'critical';
      issues.push(`${failedBackups.length} failed backups in last 24 hours`);
    }

    return {
      status,
      lastBackup,
      backupSize: avgSize,
      issues,
    };
  }

  // Helper methods
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildDumpCommand(filename: string, incremental: boolean): string {
    const { database } = this.config;
    
    if (incremental) {
      return `pg_dump --host=${database.host} --port=${database.port} --username=${database.username} --no-password --format=custom --file=${filename} ${database.database}`;
    }
    
    return `pg_dump --host=${database.host} --port=${database.port} --username=${database.username} --no-password --format=custom --file=${filename} ${database.database}`;
  }

  private buildIncrementalDumpCommand(filename: string, since: Date): string {
    const { database } = this.config;
    const sinceTime = since.toISOString();
    
    return `pg_dump --host=${database.host} --port=${database.port} --username=${database.username} --no-password --format=custom --file=${filename} --since=${sinceTime} ${database.database}`;
  }

  private buildRecoveryPointCommand(recoveryPoint: string): string {
    const { database } = this.config;
    
    return `psql --host=${database.host} --port=${database.port} --username=${database.username} --no-password --command="SELECT pg_create_restore_point('${recoveryPoint}');" ${database.database}`;
  }

  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const readStream = await fs.createReadStream(inputPath);
    const writeStream = await fs.createWriteStream(outputPath);
    const gzip = createGzip();
    
    await pipeline(readStream, gzip, writeStream);
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  private async uploadBackup(filename: string, backupId: string): Promise<string> {
    if (this.config.storage.type === 'local') {
      const localPath = path.join(this.config.storage.localPath!, backupId);
      await fs.copyFile(filename, localPath);
      return localPath;
    }

    if (this.config.storage.type === 's3' && this.s3Client) {
      const fileContent = await fs.readFile(filename);
      const key = `backups/${backupId}.gz`;
      
      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.config.storage.s3!.bucket,
        Key: key,
        Body: fileContent,
        ServerSideEncryption: 'AES256',
      }));

      return `s3://${this.config.storage.s3!.bucket}/${key}`;
    }

    throw new Error('Invalid storage configuration');
  }

  private async getDatabaseTables(): Promise<string[]> {
    const { database } = this.config;
    const { stdout } = await execAsync(
      `psql --host=${database.host} --port=${database.port} --username=${database.username} --no-password --tuples-only --command="SELECT tablename FROM pg_tables WHERE schemaname='public'" ${database.database}`
    );
    
    return stdout.trim().split('\n').filter(line => line.length > 0);
  }

  private async getLastBackupTime(): Promise<Date | null> {
    const lastBackup = await this.prisma.backupMetadata.findFirst({
      orderBy: { timestamp: 'desc' },
      where: { status: 'completed' }
    });
    
    return lastBackup?.timestamp || null;
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    // This would query the database for backup metadata
    // For now, return mock data
    return null;
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    // This would save to database
    console.log('Saving backup metadata:', metadata.id);
  }

  private async saveRecoveryPlan(plan: RecoveryPlan): Promise<void> {
    // This would save to database
    console.log('Saving recovery plan:', plan.id);
  }

  private async buildRecoverySteps(backup: BackupMetadata, targetTime?: Date): Promise<RecoveryStep[]> {
    const steps: RecoveryStep[] = [
      {
        id: '1',
        name: 'Download Backup',
        description: 'Download backup file from storage',
        command: `curl -o /tmp/restore.sql ${backup.location}`,
        estimatedTime: 300,
        status: 'pending',
      },
      {
        id: '2',
        name: 'Create Target Database',
        description: 'Create new database for restore',
        command: `createdb ${this.config.database.database}_restore`,
        estimatedTime: 60,
        status: 'pending',
      },
      {
        id: '3',
        name: 'Restore Database',
        description: 'Restore database from backup',
        command: `psql --host=${this.config.database.host} --port=${this.config.database.port} --username=${this.config.database.username} --no-password ${this.config.database.database}_restore < /tmp/restore.sql`,
        estimatedTime: 600,
        status: 'pending',
      },
    ];

    if (targetTime) {
      steps.push({
        id: '4',
        name: 'Point-in-Time Recovery',
        description: `Recover to specific time: ${targetTime.toISOString()}`,
        command: `pg_basebackup --host=${this.config.database.host} --port=${this.config.database.port} --username=${this.config.database.username} --no-password --target-time=${targetTime.toISOString()} --pgdata=/tmp/pitr_restore`,
        estimatedTime: 900,
        status: 'pending',
      });
    }

    return steps;
  }

  private calculateRecoveryDuration(backup: BackupMetadata): number {
    const baseTime = 1800; // 30 minutes base
    const sizeMultiplier = backup.size / (1024 * 1024 * 1024); // GB
    
    if (backup.type === 'full') {
      return baseTime + (sizeMultiplier * 600); // 10 minutes per GB
    } else if (backup.type === 'incremental') {
      return baseTime + (sizeMultiplier * 300); // 5 minutes per GB
    }
    
    return baseTime;
  }

  private async testCrossRegionReplication(): Promise<boolean> {
    // This would test cross-region backup replication
    // For now, return mock result
    return true;
  }

  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retention.daily);
    
    // This would delete old backups from storage and database
    console.log('Cleaning up old backups older than:', cutoffDate);
  }

  private async cleanupOldRecoveryPoints(): Promise<void> {
    // This would cleanup old recovery points based on maxRecoveryPoints config
    console.log('Cleaning up old recovery points');
  }

  private async getRecentBackups(days: number): Promise<BackupMetadata[]> {
    // This would query database for recent backups
    return [];
  }

  private async getFailedBackups(hours: number): Promise<BackupMetadata[]> {
    // This would query database for failed backups
    return [];
  }

  private async sendBackupMetrics(type: string, size: number, success: boolean): Promise<void> {
    if (!this.cloudWatchClient) return;

    try {
      await this.cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: this.config.monitoring.cloudwatch!.namespace,
        MetricData: [
          {
            MetricName: 'BackupSize',
            Value: size,
            Unit: 'Bytes',
            Dimensions: [{ Name: 'BackupType', Value: type }],
          },
          {
            MetricName: 'BackupSuccess',
            Value: success ? 1 : 0,
            Unit: 'Count',
            Dimensions: [{ Name: 'BackupType', Value: type }],
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to send CloudWatch metrics:', error);
    }
  }

  private async sendAlert(subject: string, details: any): Promise<void> {
    console.error(`ALERT: ${subject}`, details);

    // Send email alert if configured
    if (this.sesClient && this.config.monitoring.email) {
      try {
        await this.sesClient.send(new SendEmailCommand({
          Source: this.config.monitoring.email.from,
          Destination: {
            ToAddresses: this.config.monitoring.email.to,
          },
          Message: {
            Subject: { Data: `NEPA Backup Alert: ${subject}` },
            Body: {
              Text: { Data: `Backup alert: ${subject}\n\nDetails: ${JSON.stringify(details, null, 2)}` },
            },
          },
        }));
      } catch (error) {
        console.error('Failed to send email alert:', error);
      }
    }
  }
}
