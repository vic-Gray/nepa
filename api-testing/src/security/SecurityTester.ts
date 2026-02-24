import { TestClient } from '../client/TestClient';
import { TestDataGenerator } from '../data/TestDataGenerator';
import { APITestConfig, SecurityTestResult } from '../types/config';
import axios from 'axios';

export class SecurityTester {
  private client: TestClient;
  private dataGenerator: TestDataGenerator;
  private config: APITestConfig;

  constructor(config: APITestConfig) {
    this.config = config;
    this.client = new TestClient(config);
    this.dataGenerator = new TestDataGenerator(config);
  }

  async testSQLInjection(): Promise<SecurityTestResult[]> {
    console.log('Testing SQL Injection vulnerabilities...');
    const results: SecurityTestResult[] = [];

    const sqlPayloads = [
      "' OR '1'='1",
      "' OR '1'='1' --",
      "' OR '1'='1' /*",
      "admin'--",
      "admin'/*",
      "' OR 1=1--",
      "' OR 1=1#",
      "' OR 1=1/*",
      "') OR '1'='1--",
      "') OR ('1'='1--",
    ];

    for (const payload of sqlPayloads) {
      try {
        const result = await this.client.post('/api/auth/login', {
          email: payload,
          password: payload,
        });

        if (result.success && result.status !== 401) {
          results.push({
            testType: 'SQL Injection',
            vulnerability: 'Potential SQL Injection',
            severity: 'high',
            description: `SQL payload "${payload}" returned unexpected response`,
            recommendation: 'Implement parameterized queries and input validation',
            passed: false,
          });
        }
      } catch (error) {
        // Expected behavior - should fail
      }
    }

    if (results.length === 0) {
      results.push({
        testType: 'SQL Injection',
        description: 'No SQL Injection vulnerabilities detected',
        severity: 'low',
        passed: true,
      });
    }

    return results;
  }

  async testXSSVulnerabilities(): Promise<SecurityTestResult[]> {
    console.log('Testing XSS vulnerabilities...');
    const results: SecurityTestResult[] = [];

    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>",
    ];

    for (const payload of xssPayloads) {
      try {
        const result = await this.client.post('/api/users/profile', {
          name: payload,
          bio: payload,
        });

        if (result.success) {
          const responseText = JSON.stringify(result.response);
          if (responseText.includes('<script>') || responseText.includes('javascript:')) {
            results.push({
              testType: 'XSS',
              vulnerability: 'Cross-Site Scripting',
              severity: 'high',
              description: `XSS payload "${payload}" was reflected in response`,
              recommendation: 'Implement proper output encoding and Content Security Policy',
              passed: false,
            });
          }
        }
      } catch (error) {
        // Expected behavior
      }
    }

    if (results.length === 0) {
      results.push({
        testType: 'XSS',
        description: 'No XSS vulnerabilities detected',
        severity: 'low',
        passed: true,
      });
    }

    return results;
  }

  async testAuthenticationBypass(): Promise<SecurityTestResult[]> {
    console.log('Testing authentication bypass...');
    const results: SecurityTestResult[] = [];

    // Test without authentication
    try {
      const result = await this.client.get('/api/users/profile');
      
      if (result.success && result.status !== 401) {
        results.push({
          testType: 'Authentication Bypass',
          vulnerability: 'Unprotected Endpoint',
          severity: 'high',
          description: 'Protected endpoint accessible without authentication',
          recommendation: 'Implement proper authentication middleware',
          passed: false,
        });
      }
    } catch (error) {
      // Expected behavior
    }

    // Test with invalid token
    this.client.setAuthHeader('invalid-token');
    try {
      const result = await this.client.get('/api/users/profile');
      
      if (result.success && result.status !== 401) {
        results.push({
          testType: 'Authentication Bypass',
          vulnerability: 'Invalid Token Accepted',
          severity: 'high',
          description: 'Invalid authentication token was accepted',
          recommendation: 'Implement proper JWT validation',
          passed: false,
        });
      }
    } catch (error) {
      // Expected behavior
    }

    if (results.length === 0) {
      results.push({
        testType: 'Authentication Bypass',
        description: 'No authentication bypass vulnerabilities detected',
        severity: 'low',
        passed: true,
      });
    }

    return results;
  }

  async testRateLimiting(): Promise<SecurityTestResult[]> {
    console.log('Testing rate limiting...');
    const results: SecurityTestResult[] = [];

    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(this.client.post('/api/auth/login', {
        email: `test${i}@example.com`,
        password: 'password123',
      }));
    }

    const startTime = Date.now();
    const responses = await Promise.allSettled(requests);
    const duration = Date.now() - startTime;

    const successCount = responses.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    if (successCount > 50) {
      results.push({
        testType: 'Rate Limiting',
        vulnerability: 'Insufficient Rate Limiting',
        severity: 'medium',
        description: `${successCount} out of 100 requests succeeded`,
        recommendation: 'Implement proper rate limiting on authentication endpoints',
        passed: false,
      });
    } else {
      results.push({
        testType: 'Rate Limiting',
        description: 'Rate limiting is working properly',
        severity: 'low',
        passed: true,
      });
    }

    return results;
  }

  async testSecurityHeaders(): Promise<SecurityTestResult[]> {
    console.log('Testing security headers...');
    const results: SecurityTestResult[] = [];

    try {
      const response = await axios.get(this.config.baseURL);
      const headers = response.headers;

      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy',
      ];

      const missingHeaders = requiredHeaders.filter(header => !headers[header]);

      if (missingHeaders.length > 0) {
        results.push({
          testType: 'Security Headers',
          vulnerability: 'Missing Security Headers',
          severity: 'medium',
          description: `Missing headers: ${missingHeaders.join(', ')}`,
          recommendation: 'Implement all required security headers',
          passed: false,
        });
      } else {
        results.push({
          testType: 'Security Headers',
          description: 'All required security headers are present',
          severity: 'low',
          passed: true,
        });
      }
    } catch (error) {
      results.push({
        testType: 'Security Headers',
        vulnerability: 'Header Check Failed',
        severity: 'medium',
        description: 'Unable to check security headers',
        recommendation: 'Ensure server is accessible and returns proper headers',
        passed: false,
      });
    }

    return results;
  }

  async testInputValidation(): Promise<SecurityTestResult[]> {
    console.log('Testing input validation...');
    const results: SecurityTestResult[] = [];

    const invalidInputs = [
      { email: 'invalid-email', password: '123' },
      { email: 'test@example.com', password: '' },
      { email: '', password: 'password123' },
      { email: 'a'.repeat(500), password: 'password123' },
      { email: 'test@example.com', password: 'a'.repeat(500) },
    ];

    for (const input of invalidInputs) {
      try {
        const result = await this.client.post('/api/auth/register', input);
        
        if (result.success && result.status !== 400) {
          results.push({
            testType: 'Input Validation',
            vulnerability: 'Insufficient Input Validation',
            severity: 'medium',
            description: `Invalid input was accepted: ${JSON.stringify(input)}`,
            recommendation: 'Implement proper input validation',
            passed: false,
          });
        }
      } catch (error) {
        // Expected behavior
      }
    }

    if (results.length === 0) {
      results.push({
        testType: 'Input Validation',
        description: 'Input validation is working properly',
        severity: 'low',
        passed: true,
      });
    }

    return results;
  }

  async runAllTests(): Promise<SecurityTestResult[]> {
    console.log('Running security tests...');
    
    const allResults: SecurityTestResult[] = [];
    
    try {
      allResults.push(...await this.testSQLInjection());
      allResults.push(...await this.testXSSVulnerabilities());
      allResults.push(...await this.testAuthenticationBypass());
      allResults.push(...await this.testRateLimiting());
      allResults.push(...await this.testSecurityHeaders());
      allResults.push(...await this.testInputValidation());

      const failedTests = allResults.filter(result => !result.passed);
      
      if (failedTests.length === 0) {
        console.log('✓ All security tests passed');
      } else {
        console.log(`✗ ${failedTests.length} security tests failed`);
        failedTests.forEach(test => {
          console.log(`  - ${test.testType}: ${test.description}`);
        });
      }

      return allResults;
    } catch (error) {
      console.error('✗ Security tests failed:', error);
      throw error;
    }
  }
}
