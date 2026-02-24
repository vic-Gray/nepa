import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be less than 10%
    errors: ['rate<0.1'],             // Custom error rate should be less than 10%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

export function setup() {
  // Setup code - create test data if needed
  console.log('Setting up load test...');
  
  // Create a test user for authentication
  const payload = JSON.stringify({
    email: `loadtest-${Date.now()}@example.com`,
    username: `loadtestuser${Date.now()}`,
    name: 'Load Test User',
    password: 'password123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = http.post(`${BASE_URL}/api/auth/register`, payload, params);
  
  if (response.status !== 201) {
    console.error('Failed to create test user:', response.status, response.body);
    return null;
  }

  // Login to get token
  const loginPayload = JSON.stringify({
    email: payload.email,
    password: 'password123',
  });

  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, loginPayload, params);
  
  if (loginResponse.status !== 200) {
    console.error('Failed to login test user:', loginResponse.status, loginResponse.body);
    return null;
  }

  const token = JSON.parse(loginResponse.body).token;
  return { token };
}

export default function(data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data?.token || ''}`,
    },
  };

  // Test user profile endpoint
  const profileResponse = http.get(`${BASE_URL}/api/users/profile`, params);
  const profileOk = check(profileResponse, {
    'profile status is 200': (r) => r.status === 200,
    'profile response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!profileOk);

  // Test bills endpoint
  const billsResponse = http.get(`${BASE_URL}/api/billing/bills`, params);
  const billsOk = check(billsResponse, {
    'bills status is 200': (r) => r.status === 200,
    'bills response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!billsOk);

  // Test payments history endpoint
  const paymentsResponse = http.get(`${BASE_URL}/api/payments/history`, params);
  const paymentsOk = check(paymentsResponse, {
    'payments status is 200': (r) => r.status === 200,
    'payments response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!paymentsOk);

  // Test notification preferences endpoint
  const notifResponse = http.get(`${BASE_URL}/api/notifications/preferences`, params);
  const notifOk = check(notifResponse, {
    'notifications status is 200': (r) => r.status === 200,
    'notifications response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!notifOk);

  sleep(1); // Wait 1 second between iterations
}

export function teardown(data) {
  // Cleanup code - remove test data if needed
  console.log('Tearing down load test...');
}
