#!/bin/bash

URL=$1
MAX_RETRIES=12
RETRY_DELAY=10

echo "Starting health check for: $URL"

for ((i=1; i<=MAX_RETRIES; i++)); do
  echo "Attempt $i of $MAX_RETRIES..."
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" $URL)
  
  if [ "$STATUS_CODE" -eq 200 ]; then
    echo "Health check PASSED with status code 200."
    exit 0
  fi
  
  echo "Health check failed with status code $STATUS_CODE. Retrying in $RETRY_DELAY seconds..."
  sleep $RETRY_DELAY
done

echo "Health check FAILED after $MAX_RETRIES attempts."
exit 1