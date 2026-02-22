#!/bin/bash

# Database Per Service Setup Script
# This script creates individual databases for each microservice

set -e

echo "🚀 Setting up Database Per Service architecture..."

# Database configuration
DB_USER="${DB_USER:-user}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_HOST="${DB_HOST:-localhost}"

# Service databases
SERVICES=(
  "nepa_user_service:5432"
  "nepa_notification_service:5433"
  "nepa_document_service:5434"
  "nepa_utility_service:5435"
  "nepa_payment_service:5436"
  "nepa_billing_service:5437"
  "nepa_analytics_service:5438"
  "nepa_webhook_service:5439"
)

# Function to create database
create_database() {
  local db_name=$1
  local port=$2
  
  echo "📦 Creating database: $db_name on port $port"
  
  # Check if database exists
  if psql -h $DB_HOST -p $port -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $db_name; then
    echo "✅ Database $db_name already exists"
  else
    createdb -h $DB_HOST -p $port -U $DB_USER $db_name
    echo "✅ Database $db_name created successfully"
  fi
}

# Create databases for each service
for service in "${SERVICES[@]}"; do
  IFS=':' read -r db_name port <<< "$service"
  create_database $db_name $port
done

echo ""
echo "✅ All databases created successfully!"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the database URLs"
echo "2. Run: npm run db:generate-all"
echo "3. Run: npm run db:migrate-all"
