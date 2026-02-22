#!/bin/bash

# Restore a specific service database from backup
set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: ./restore-database.sh <service-name> <backup-file>"
  echo "Example: ./restore-database.sh user-service ./backups/20240101/nepa_user_service_20240101_120000.sql.gz"
  exit 1
fi

SERVICE_NAME=$1
BACKUP_FILE=$2

# Database configuration
DB_USER="${DB_USER:-user}"
DB_HOST="${DB_HOST:-localhost}"

# Map service names to database names and ports
declare -A SERVICE_MAP=(
  ["user-service"]="nepa_user_service:5432"
  ["notification-service"]="nepa_notification_service:5433"
  ["document-service"]="nepa_document_service:5434"
  ["utility-service"]="nepa_utility_service:5435"
  ["payment-service"]="nepa_payment_service:5436"
  ["billing-service"]="nepa_billing_service:5437"
  ["analytics-service"]="nepa_analytics_service:5438"
  ["webhook-service"]="nepa_webhook_service:5439"
)

if [ -z "${SERVICE_MAP[$SERVICE_NAME]}" ]; then
  echo "❌ Unknown service: $SERVICE_NAME"
  exit 1
fi

IFS=':' read -r DB_NAME PORT <<< "${SERVICE_MAP[$SERVICE_NAME]}"

echo "⚠️  WARNING: This will restore $DB_NAME from backup"
echo "📁 Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Restore cancelled"
  exit 0
fi

echo "🔄 Restoring $DB_NAME..."

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE | psql -h $DB_HOST -p $PORT -U $DB_USER $DB_NAME
else
  psql -h $DB_HOST -p $PORT -U $DB_USER $DB_NAME < $BACKUP_FILE
fi

echo "✅ Database restored successfully!"
