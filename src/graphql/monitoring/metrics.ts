import { register, Counter, Histogram, Gauge } from 'prom-client';

// GraphQL Metrics
export const graphqlRequestCounter = new Counter({
  name: 'graphql_requests_total',
  help: 'Total number of GraphQL requests',
  labelNames: ['operation', 'fieldName', 'status'],
  registers: [register],
});

export const graphqlRequestDuration = new Histogram({
  name: 'graphql_request_duration_seconds',
  help: 'Duration of GraphQL requests in seconds',
  labelNames: ['operation', 'fieldName'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const graphqlErrorCounter = new Counter({
  name: 'graphql_errors_total',
  help: 'Total number of GraphQL errors',
  labelNames: ['operation', 'fieldName', 'errorType'],
  registers: [register],
});

export const activeConnectionsGauge = new Gauge({
  name: 'graphql_active_connections',
  help: 'Number of active GraphQL connections',
  registers: [register],
});

export const subscriptionCounter = new Counter({
  name: 'graphql_subscriptions_total',
  help: 'Total number of GraphQL subscriptions',
  labelNames: ['subscriptionName', 'status'],
  registers: [register],
});

export const queryComplexityHistogram = new Histogram({
  name: 'graphql_query_complexity',
  help: 'Complexity of GraphQL queries',
  buckets: [1, 5, 10, 20, 50, 100],
  registers: [register],
});

// Metrics collection functions
export const recordRequest = (operation: string, fieldName: string, status: string, duration: number) => {
  graphqlRequestCounter.labels(operation, fieldName, status).inc();
  graphqlRequestDuration.labels(operation, fieldName).observe(duration);
};

export const recordError = (operation: string, fieldName: string, errorType: string) => {
  graphqlErrorCounter.labels(operation, fieldName, errorType).inc();
};

export const recordSubscription = (subscriptionName: string, status: string) => {
  subscriptionCounter.labels(subscriptionName, status).inc();
};

export const updateActiveConnections = (count: number) => {
  activeConnectionsGauge.set(count);
};

export const recordQueryComplexity = (complexity: number) => {
  queryComplexityHistogram.observe(complexity);
};
