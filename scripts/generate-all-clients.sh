#!/bin/bash

# Generate Prisma clients for all services
set -e

echo "🔄 Generating Prisma clients for all services..."

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
  echo "📦 Generating client for $service..."
  npx prisma generate --schema=databases/$service/schema.prisma
  echo "✅ $service client generated"
done

echo ""
echo "✅ All Prisma clients generated successfully!"
