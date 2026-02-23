#!/bin/bash

# Start observability stack
set -e

echo "🚀 Starting NEPA Observability Stack..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Start observability services
echo "📦 Starting observability services..."
docker-compose -f docker-compose.observability.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

services=(
  "prometheus:9090"
  "grafana:3000"
  "jaeger:16686"
  "loki:3100"
  "alertmanager:9093"
)

for service in "${services[@]}"; do
  IFS=':' read -r name port <<< "$service"
  if curl -s "http://localhost:$port" > /dev/null; then
    echo "✅ $name is healthy"
  else
    echo "⚠️  $name may not be ready yet"
  fi
done

echo ""
echo "✅ Observability stack started successfully!"
echo ""
echo "Access the dashboards:"
echo "  📊 Grafana:       http://localhost:3000 (admin/admin)"
echo "  📈 Prometheus:    http://localhost:9090"
echo "  🔍 Jaeger:        http://localhost:16686"
echo "  🚨 Alertmanager:  http://localhost:9093"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.observability.yml logs -f"
echo ""
echo "To stop:"
echo "  docker-compose -f docker-compose.observability.yml down"
