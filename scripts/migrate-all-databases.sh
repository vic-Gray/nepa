#!/bin/bash

# Migrate all service databases
set -e

echo "🔄 Running migrations for all services..."

SERVICES=(
  "user-service"
  "notification-service"
  "document-service"
  "utility-service"
  "payment-service"
  "billing-service"
  "analytics-service"
  "webhook-service"
)

for service in "${SERVICES[@]}"; do
  echo ""
  echo "📦 Migrating $service database..."
  npx prisma migrate dev --schema=databases/$service/schema.prisma --name init
  echo "✅ $service migration completed"
done

echo ""
echo "✅ All database migrations completed successfully!"
