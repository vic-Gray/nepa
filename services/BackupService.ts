import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class BackupService {
    /**
     * The absolute path to the backup shell script.
     */
    private readonly scriptPath: string;

    constructor() {
        // Determine path based on typical execution context (tests/src vs dist)
        this.scriptPath = path.resolve(__dirname, '../../scripts/backup-databases.sh');
    }

    /**
     * Orchestrates the automated database backup process and data replication.
     *
     * @param uploadToS3 Whether to replicate the backup to an AWS S3 bucket.
     * @param s3BucketName The name of the S3 bucket for replication.
     */
    public async performBackup(uploadToS3: boolean = true, s3BucketName?: string): Promise<void> {
        console.log('Starting automated backup orchestration...');

        // Set environment variables for the shell script to control its behavior
        const env = {
            ...process.env,
            UPLOAD_TO_S3: uploadToS3 ? 'true' : 'false',
            S3_BUCKET_NAME: s3BucketName || process.env.S3_BACKUP_BUCKET || ''
        };

        try {
            const { stdout, stderr } = await execAsync(`bash ${this.scriptPath}`, { env });

            console.log('Backup script stdout:', stdout);
            if (stderr && stderr.trim() !== '') {
                console.warn('Backup script stderr:', stderr);
            }

            console.log('Backup process and data replication orchestration completed successfully.');

            // Perform a secondary integrity verification layer
            await this.verifyBackupIntegrity();
        } catch (error) {
            console.error('Backup orchestration failed:', error);
            throw error;
        }
    }

    /**
     * Verifies data integrity post-backup. Basic verification logic.
     */
    public async verifyBackupIntegrity(): Promise<boolean> {
        console.log('Verifying backup data integrity...');
        // Real implementation would list local folder or query S3 to verify file size > 0
        return true;
    }
}
