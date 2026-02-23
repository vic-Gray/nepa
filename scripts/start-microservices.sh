#!/bin/bash

echo "Starting all microservices..."

ts-node microservices/user-service/index.ts &
ts-node microservices/payment-service/index.ts &
ts-node microservices/billing-service/index.ts &
ts-node microservices/notification-service/index.ts &
ts-node microservices/document-service/index.ts &
ts-node microservices/utility-service/index.ts &
ts-node microservices/analytics-service/index.ts &
ts-node microservices/webhook-service/index.ts &
ts-node microservices/api-gateway/index.ts &

wait
