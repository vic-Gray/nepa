#!/bin/bash

# Automated backup script for all service databases
set -e

BACKUP_DIR="./backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

echo "🔄 Starting database backups..."

# Database configuration
DB_USER="${DB_USER:-user}"
DB_HOST="${DB_HOST:-localhost}"

# Service databases with ports
declare -A DATABASES=(
  ["nepa_user_service"]="5432"
  ["nepa_notification_service"]="5433"
  ["nepa_document_service"]="5434"
  ["nepa_utility_service"]="5435"
  ["nepa_payment_service"]="5436"
  ["nepa_billing_service"]="5437"
  ["nepa_analytics_service"]="5438"
  ["nepa_webhook_service"]="5439"
)

# Backup each database
for db_name in "${!DATABASES[@]}"; do
  port="${DATABASES[$db_name]}"
  backup_file="$BACKUP_DIR/${db_name}_$(date +%Y%m%d_%H%M%S).sql"
  
  echo "📦 Backing up $db_name..."
  pg_dump -h $DB_HOST -p $port -U $DB_USER $db_name > $backup_file
  
  # Compress backup
  gzip $backup_file
  echo "✅ $db_name backed up to ${backup_file}.gz"
done

# Clean up old backups (keep last 30 days)
find ./backups -type d -mtime +30 -exec rm -rf {} +

echo ""
echo "✅ All database backups completed successfully!"
echo "📁 Backups saved to: $BACKUP_DIR"
