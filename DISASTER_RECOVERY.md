# Disaster Recovery Plan

This document outlines the disaster recovery procedures for the Nepa service databases, addressing potential data loss and ensuring geographic redundancy.

## Automated Backups

- **Frequency:** Daily at 02:00 AM UTC via GitHub Actions.
- **Storage:** Local compressed `.sql.gz` files in the `backups/` directory, retained for 30 days.
- **Replication/Redundancy:** Uploaded to an AWS S3 bucket for geographic redundancy and off-site secure storage.

## Complete Data Recovery Procedure

If a database fails, data is corrupted, or a disastrous event occurs, follow these steps to restore from the latest backup:

### 1. Identify the Target Backup
Locate the desired backup file.
- **If the local server is intact:** Check `./backups/YYYYMMDD/` for the relevant `.sql.gz` file.
- **If the local server is lost (Geographic Redundancy):** Download the backup directly from the S3 Bucket:
  ```bash
  aws s3 cp s3://<YOUR_BUCKET_NAME>/backups/YYYYMMDD/<db_name>_timestamp.sql.gz ./local_backups/
  ```

### 2. Prepare the Database Environment
Ensure the PostgreSQL server is running and accessible. Drop the corrupted database (if it exists) and recreate an empty one:
```bash
dropdb -h localhost -p 5432 -U <db_user> nepa_payment_service
createdb -h localhost -p 5432 -U <db_user> nepa_payment_service
```

### 3. Restore the Database
Decompress the backup and pipe it directly into `psql`:
```bash
gunzip -c ./backups/20260223/nepa_payment_service_20260223_020000.sql.gz | psql -h localhost -p 5432 -U <db_user> -d nepa_payment_service
```

### 4. Verify Data Integrity
After restoration, you must verify the integrity of the data:
- Start the backend services and check the health/logs to verify successful connection.
- Use `BackupService.verifyBackupIntegrity()` in the code to ensure data structures are intact.
- Manually run row counts for critical tables via SQL (e.g., `SELECT COUNT(*) FROM payments;`) and compare against pre-disaster state or the previous day's metrics.

## Regular Recovery Testing

We orchestrate automated unit tests ensuring the validity of our backup service logic running daily. See `tests/backup.test.ts` for the automated verification suite. It tests data replication payload correctness and orchestration.
