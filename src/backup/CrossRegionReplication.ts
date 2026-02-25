import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Readable } from 'stream';

export interface ReplicationConfig {
  source: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  destinations: Array<{
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    priority: number; // 1 = highest priority
  }>;
  replication: {
    enabled: boolean;
    realTime: boolean;
    intervalMinutes: number;
    batchSize: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  monitoring: {
    cloudwatch?: {
      region: string;
      namespace: string;
    };
    alerts: {
      replicationDelayThreshold: number; // minutes
      failureThreshold: number; // consecutive failures
    };
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyId?: string; // KMS key ID
  };
}

export interface ReplicationTask {
  id: string;
  sourceKey: string;
  destinationRegion: string;
  destinationBucket: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  size: number;
  checksum: string;
  retries: number;
  error?: string;
}

export interface ReplicationMetrics {
  totalFiles: number;
  totalSize: number;
  successfulReplications: number;
  failedReplications: number;
  averageLatency: number;
  lastReplicationTime: Date;
  replicationDelay: number; // minutes behind source
}

export class CrossRegionReplication extends EventEmitter {
  private config: ReplicationConfig;
  private sourceClient: S3Client;
  private destinationClients: Map<string, S3Client> = new Map();
  private replicationQueue: ReplicationTask[] = [];
  private isProcessing: boolean = false;
  private metrics: ReplicationMetrics;

  constructor(config: ReplicationConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    
    // Initialize S3 clients
    this.sourceClient = new S3Client({
      region: config.source.region,
      credentials: {
        accessKeyId: config.source.accessKeyId,
        secretAccessKey: config.source.secretAccessKey,
      },
    });

    // Initialize destination clients
    config.destinations.forEach(dest => {
      const client = new S3Client({
        region: dest.region,
        credentials: {
          accessKeyId: dest.accessKeyId,
          secretAccessKey: dest.secretAccessKey,
        },
      });
      this.destinationClients.set(dest.region, client);
    });

    if (config.replication.enabled) {
      this.startReplication();
    }
  }

  /**
   * Start replication process
   */
  private startReplication(): void {
    if (this.config.replication.realTime) {
      this.startRealTimeReplication();
    } else {
      this.startScheduledReplication();
    }
  }

  /**
   * Start real-time replication using S3 event notifications
   */
  private startRealTimeReplication(): void {
    // This would typically use S3 event notifications via SQS or SNS
    // For now, we'll simulate with polling
    setInterval(async () => {
      await this.checkForNewFiles();
    }, 60000); // Check every minute
  }

  /**
   * Start scheduled replication
   */
  private startScheduledReplication(): void {
    setInterval(async () => {
      await this.performScheduledReplication();
    }, this.config.replication.intervalMinutes * 60 * 1000);
  }

  /**
   * Check for new files to replicate
   */
  private async checkForNewFiles(): Promise<void> {
    try {
      const newFiles = await this.getNewFiles();
      
      for (const file of newFiles) {
        await this.queueReplication(file);
      }

      if (newFiles.length > 0) {
        await this.processReplicationQueue();
      }
    } catch (error) {
      console.error('Error checking for new files:', error);
      this.emit('error', error);
    }
  }

  /**
   * Perform scheduled replication
   */
  private async performScheduledReplication(): Promise<void> {
    try {
      const allFiles = await this.getAllSourceFiles();
      const replicatedFiles = await this.getReplicatedFiles();
      
      const filesToReplicate = allFiles.filter(file => 
        !replicatedFiles.some(replicated => replicated.key === file.key)
      );

      for (const file of filesToReplicate) {
        await this.queueReplication(file);
      }

      if (filesToReplicate.length > 0) {
        await this.processReplicationQueue();
      }
    } catch (error) {
      console.error('Error in scheduled replication:', error);
      this.emit('error', error);
    }
  }

  /**
   * Queue file for replication
   */
  private async queueReplication(file: any): Promise<void> {
    const destinations = this.config.destinations
      .sort((a, b) => a.priority - b.priority);

    for (const dest of destinations) {
      const task: ReplicationTask = {
        id: this.generateTaskId(),
        sourceKey: file.key,
        destinationRegion: dest.region,
        destinationBucket: dest.bucket,
        status: 'pending',
        startTime: new Date(),
        size: file.size || 0,
        checksum: file.checksum || '',
        retries: 0,
      };

      this.replicationQueue.push(task);
    }
  }

  /**
   * Process replication queue
   */
  private async processReplicationQueue(): Promise<void> {
    if (this.isProcessing || this.replicationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.replicationQueue.splice(0, this.config.replication.batchSize);
      
      await Promise.allSettled(
        batch.map(task => this.replicateFile(task))
      );

      // Update metrics
      await this.updateMetrics();
      
    } catch (error) {
      console.error('Error processing replication queue:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Replicate single file to destination
   */
  private async replicateFile(task: ReplicationTask): Promise<void> {
    task.status = 'in_progress';
    
    try {
      // Get file from source
      const sourceObject = await this.sourceClient.send(new GetObjectCommand({
        Bucket: this.config.source.bucket,
        Key: task.sourceKey,
      }));

      // Prepare destination parameters
      const destClient = this.destinationClients.get(task.destinationRegion);
      if (!destClient) {
        throw new Error(`No client configured for region: ${task.destinationRegion}`);
      }

      // Copy to destination with encryption if enabled
      const putParams: any = {
        Bucket: task.destinationBucket,
        Key: task.sourceKey,
        Body: sourceObject.Body,
        ContentType: sourceObject.ContentType,
        Metadata: sourceObject.Metadata,
      };

      if (this.config.encryption.enabled) {
        if (this.config.encryption.keyId) {
          putParams.ServerSideEncryption = 'aws:kms';
          putParams.SSEKMSKeyId = this.config.encryption.keyId;
        } else {
          putParams.ServerSideEncryption = 'AES256';
        }
      }

      await destClient.send(new PutObjectCommand(putParams));

      // Verify replication
      await this.verifyReplication(task);

      task.status = 'completed';
      task.endTime = new Date();

      this.emit('replicationCompleted', task);

    } catch (error) {
      task.error = error.message;
      task.retries++;

      if (task.retries < this.config.replication.maxRetries) {
        // Retry after delay
        setTimeout(() => {
          this.replicationQueue.push(task);
        }, this.config.replication.retryDelayMs);
      } else {
        task.status = 'failed';
        this.emit('replicationFailed', task);
      }
    }
  }

  /**
   * Verify replication by comparing checksums
   */
  private async verifyReplication(task: ReplicationTask): Promise<void> {
    const destClient = this.destinationClients.get(task.destinationRegion);
    if (!destClient) return;

    const destObject = await destClient.send(new GetObjectCommand({
      Bucket: task.destinationBucket,
      Key: task.sourceKey,
    }));

    // Calculate checksum of destination object
    const destChecksum = await this.calculateStreamChecksum(destObject.Body as Readable);
    
    if (destChecksum !== task.checksum) {
      throw new Error(`Checksum mismatch for ${task.sourceKey}`);
    }
  }

  /**
   * Get new files from source bucket
   */
  private async getNewFiles(): Promise<any[]> {
    // This would typically use S3 event notifications
    // For now, we'll get recent files
    const listParams = {
      Bucket: this.config.source.bucket,
      MaxKeys: this.config.replication.batchSize,
    };

    const response = await this.sourceClient.send(new GetObjectCommand(listParams));
    
    return response.Contents?.filter(obj => 
      obj.Key?.startsWith('backups/') && 
      obj.LastModified && 
      obj.LastModified > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    ) || [];
  }

  /**
   * Get all files from source bucket
   */
  private async getAllSourceFiles(): Promise<any[]> {
    const files: any[] = [];
    let continuationToken: string | undefined;

    do {
      const listParams: any = {
        Bucket: this.config.source.bucket,
        MaxKeys: 1000,
      };

      if (continuationToken) {
        listParams.ContinuationToken = continuationToken;
      }

      const response = await this.sourceClient.send(new GetObjectCommand(listParams));
      
      if (response.Contents) {
        files.push(...response.Contents.filter(obj => obj.Key?.startsWith('backups/')));
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  }

  /**
   * Get list of already replicated files
   */
  private async getReplicatedFiles(): Promise<any[]> {
    // This would query a database or metadata store
    // For now, return empty array
    return [];
  }

  /**
   * Calculate checksum of a stream
   */
  private async calculateStreamChecksum(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Update replication metrics
   */
  private async updateMetrics(): Promise<void> {
    const completedTasks = this.replicationQueue.filter(t => t.status === 'completed');
    const failedTasks = this.replicationQueue.filter(t => t.status === 'failed');

    this.metrics.totalFiles = this.replicationQueue.length;
    this.metrics.totalSize = this.replicationQueue.reduce((sum, t) => sum + t.size, 0);
    this.metrics.successfulReplications = completedTasks.length;
    this.metrics.failedReplications = failedTasks.length;

    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, t) => 
        sum + (t.endTime!.getTime() - t.startTime.getTime()), 0
      );
      this.metrics.averageLatency = totalTime / completedTasks.length;
    }

    this.metrics.lastReplicationTime = new Date();

    // Send metrics to CloudWatch
    await this.sendMetrics();

    // Check for alerts
    await this.checkAlerts();
  }

  /**
   * Send metrics to CloudWatch
   */
  private async sendMetrics(): Promise<void> {
    if (!this.config.monitoring.cloudwatch) return;

    const cloudWatchClient = new CloudWatchClient({
      region: this.config.monitoring.cloudwatch.region,
    });

    try {
      await cloudWatchClient.send(new PutMetricDataCommand({
        Namespace: this.config.monitoring.cloudwatch.namespace,
        MetricData: [
          {
            MetricName: 'ReplicationLatency',
            Value: this.metrics.averageLatency,
            Unit: 'Milliseconds',
          },
          {
            MetricName: 'ReplicationSuccessRate',
            Value: this.metrics.totalFiles > 0 ? 
              (this.metrics.successfulReplications / this.metrics.totalFiles) * 100 : 0,
            Unit: 'Percent',
          },
          {
            MetricName: 'ReplicationQueueSize',
            Value: this.replicationQueue.length,
            Unit: 'Count',
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to send CloudWatch metrics:', error);
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(): Promise<void> {
    const { alerts } = this.config.monitoring;

    // Check replication delay
    if (this.metrics.replicationDelay > alerts.replicationDelayThreshold) {
      this.emit('alert', {
        type: 'replication_delay',
        message: `Replication delay: ${this.metrics.replicationDelay} minutes`,
        threshold: alerts.replicationDelayThreshold,
      });
    }

    // Check failure threshold
    if (this.metrics.failedReplications >= alerts.failureThreshold) {
      this.emit('alert', {
        type: 'replication_failures',
        message: `${this.metrics.failedReplications} replication failures`,
        threshold: alerts.failureThreshold,
      });
    }
  }

  /**
   * Test cross-region replication
   */
  async testReplication(): Promise<{
    success: boolean;
    latency: number;
    throughput: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const testFile = {
      key: 'test/replication-test.txt',
      size: 1024, // 1KB test file
      checksum: crypto.createHash('sha256').update('test data').digest('hex'),
    };

    try {
      // Upload test file to source
      await this.sourceClient.send(new PutObjectCommand({
        Bucket: this.config.source.bucket,
        Key: testFile.key,
        Body: 'test data',
        ContentType: 'text/plain',
      }));

      // Wait for replication
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

      // Verify replication to all destinations
      let allReplicated = true;
      for (const dest of this.config.destinations) {
        const destClient = this.destinationClients.get(dest.region);
        if (destClient) {
          try {
            await destClient.send(new GetObjectCommand({
              Bucket: dest.bucket,
              Key: testFile.key,
            }));
          } catch (error) {
            allReplicated = false;
            break;
          }
        }
      }

      const latency = Date.now() - startTime;
      const throughput = testFile.size / (latency / 1000); // bytes per second

      // Cleanup test file
      await this.sourceClient.send(new PutObjectCommand({
        Bucket: this.config.source.bucket,
        Key: testFile.key,
      }));

      return {
        success: allReplicated,
        latency,
        throughput,
      };

    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        throughput: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get replication status
   */
  getReplicationStatus(): {
    queueSize: number;
    processing: boolean;
    metrics: ReplicationMetrics;
    destinations: Array<{
      region: string;
      bucket: string;
      status: string;
      lastReplication: Date;
    }>;
  } {
    const destinations = this.config.destinations.map(dest => ({
      region: dest.region,
      bucket: dest.bucket,
      status: 'active', // This would be determined by actual health checks
      lastReplication: this.metrics.lastReplicationTime,
    }));

    return {
      queueSize: this.replicationQueue.length,
      processing: this.isProcessing,
      metrics: this.metrics,
      destinations,
    };
  }

  /**
   * Force immediate replication of specific file
   */
  async forceReplication(sourceKey: string): Promise<ReplicationTask[]> {
    const file = { key: sourceKey, size: 0, checksum: '' };
    await this.queueReplication(file);
    
    const tasks = this.replicationQueue.filter(t => t.sourceKey === sourceKey);
    await this.processReplicationQueue();
    
    return tasks;
  }

  // Helper methods
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): ReplicationMetrics {
    return {
      totalFiles: 0,
      totalSize: 0,
      successfulReplications: 0,
      failedReplications: 0,
      averageLatency: 0,
      lastReplicationTime: new Date(),
      replicationDelay: 0,
    };
  }
}
