import { BackupService } from '../services/BackupService';

// Mocking child_process to prevent actual script execution during unit tests
jest.mock('child_process', () => {
    return {
        exec: jest.fn((cmd, options, callback) => {
            // Simulate successful backup shell script execution
            callback(null, { stdout: 'Backup script executed successfully', stderr: '' });
        })
    };
});

describe('BackupService', () => {
    let backupService: BackupService;

    beforeEach(() => {
        backupService = new BackupService();
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should successfully orchestrate automated backups', async () => {
        // Expect performBackup not to throw any error
        await expect(backupService.performBackup(false)).resolves.not.toThrow();
    });

    it('should verify backup integrity', async () => {
        const isIntegrityValid = await backupService.verifyBackupIntegrity();
        expect(isIntegrityValid).toBe(true);
    });

    it('should handle environment variables for AWS S3 replication', async () => {
        await backupService.performBackup(true, 'my-test-s3-bucket');
        const childProcess = require('child_process');

        // Check if exec was called with the correct mock
        expect(childProcess.exec).toHaveBeenCalledTimes(1);

        const callArgs = childProcess.exec.mock.calls[0];
        const envPassed = callArgs[1].env;

        // Verify that data replication env arrays are properly mapped to trigger geographic redundancy
        expect(envPassed.UPLOAD_TO_S3).toBe('true');
        expect(envPassed.S3_BUCKET_NAME).toBe('my-test-s3-bucket');
    });
});
