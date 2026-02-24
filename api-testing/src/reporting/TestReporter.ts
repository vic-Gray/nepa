import { APITestConfig, TestResult, PerformanceTestResult, SecurityTestResult, ContractTestResult } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

export interface TestReport {
  timestamp: string;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    successRate: number;
    totalDuration: number;
  };
  unitTests: TestResult[];
  integrationTests: TestResult[];
  e2eTests: TestResult[];
  performanceTests: PerformanceTestResult[];
  securityTests: SecurityTestResult[];
  contractTests: ContractTestResult[];
  recommendations: string[];
}

export class TestReporter {
  private config: APITestConfig;
  private report: TestReport;

  constructor(config: APITestConfig) {
    this.config = config;
    this.report = this.initializeReport();
  }

  private initializeReport(): TestReport {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        successRate: 0,
        totalDuration: 0,
      },
      unitTests: [],
      integrationTests: [],
      e2eTests: [],
      performanceTests: [],
      securityTests: [],
      contractTests: [],
      recommendations: [],
    };
  }

  addUnitTest(result: TestResult): void {
    this.report.unitTests.push(result);
    this.updateSummary();
  }

  addIntegrationTest(result: TestResult): void {
    this.report.integrationTests.push(result);
    this.updateSummary();
  }

  addE2ETest(result: TestResult): void {
    this.report.e2eTests.push(result);
    this.updateSummary();
  }

  addPerformanceTest(result: PerformanceTestResult): void {
    this.report.performanceTests.push(result);
    this.updateSummary();
  }

  addSecurityTest(result: SecurityTestResult): void {
    this.report.securityTests.push(result);
    this.updateSummary();
  }

  addContractTest(result: ContractTestResult): void {
    this.report.contractTests.push(result);
    this.updateSummary();
  }

  private updateSummary(): void {
    const allTests = [
      ...this.report.unitTests.map(t => ({ success: t.success })),
      ...this.report.integrationTests.map(t => ({ success: t.success })),
      ...this.report.e2eTests.map(t => ({ success: t.success })),
      ...this.report.performanceTests.map(t => ({ success: t.errorRate === 0 })),
      ...this.report.securityTests.map(t => ({ success: t.passed })),
      ...this.report.contractTests.map(t => ({ success: t.success })),
    ];

    this.report.summary.totalTests = allTests.length;
    this.report.summary.passedTests = allTests.filter(t => t.success).length;
    this.report.summary.failedTests = allTests.filter(t => !t.success).length;
    this.report.summary.successRate = (this.report.summary.passedTests / this.report.summary.totalTests) * 100;
  }

  generateRecommendations(): void {
    const recommendations: string[] = [];

    // Performance recommendations
    const slowTests = this.report.performanceTests.filter(test => test.avgResponseTime > 1000);
    if (slowTests.length > 0) {
      recommendations.push(`Consider optimizing ${slowTests.length} slow endpoints (avg response time > 1s)`);
    }

    const highErrorRateTests = this.report.performanceTests.filter(test => test.errorRate > 5);
    if (highErrorRateTests.length > 0) {
      recommendations.push(`Investigate ${highErrorRateTests.length} endpoints with high error rates (>5%)`);
    }

    // Security recommendations
    const failedSecurityTests = this.report.securityTests.filter(test => !test.passed);
    if (failedSecurityTests.length > 0) {
      recommendations.push(`Address ${failedSecurityTests.length} security vulnerabilities immediately`);
    }

    // Contract recommendations
    const failedContractTests = this.report.contractTests.filter(test => !test.success);
    if (failedContractTests.length > 0) {
      recommendations.push(`Fix ${failedContractTests.length} contract violations to ensure service compatibility`);
    }

    // Overall recommendations
    if (this.report.summary.successRate < 90) {
      recommendations.push('Overall test success rate is below 90%. Review and fix failing tests.');
    }

    if (this.report.summary.successRate === 100) {
      recommendations.push('Excellent! All tests are passing. Consider adding more edge case tests.');
    }

    this.report.recommendations = recommendations;
  }

  async generateHTMLReport(): Promise<string> {
    const outputDir = this.config.reporting?.outputDir || path.join(process.cwd(), 'test-reports');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.generateRecommendations();

    const htmlContent = this.generateHTMLContent();
    const reportPath = path.join(outputDir, `api-test-report-${Date.now()}.html`);
    
    fs.writeFileSync(reportPath, htmlContent);
    
    console.log(`✓ HTML report generated: ${reportPath}`);
    return reportPath;
  }

  async generateJSONReport(): Promise<string> {
    const outputDir = this.config.reporting?.outputDir || path.join(process.cwd(), 'test-reports');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.generateRecommendations();

    const reportPath = path.join(outputDir, `api-test-report-${Date.now()}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    
    console.log(`✓ JSON report generated: ${reportPath}`);
    return reportPath;
  }

  async generateJUnitReport(): Promise<string> {
    const outputDir = this.config.reporting?.outputDir || path.join(process.cwd(), 'test-reports');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const junitContent = this.generateJUnitContent();
    const reportPath = path.join(outputDir, `junit-report-${Date.now()}.xml`);
    
    fs.writeFileSync(reportPath, junitContent);
    
    console.log(`✓ JUnit report generated: ${reportPath}`);
    return reportPath;
  }

  private generateHTMLContent(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Test Report - ${this.report.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .test-item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; }
        .test-item.failed { border-left-color: #dc3545; }
        .test-item.warning { border-left-color: #ffc107; }
        .recommendations { background: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; }
        .recommendations ul { margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>API Test Report</h1>
            <p>Generated on ${new Date(this.report.timestamp).toLocaleString()}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${this.report.summary.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value success">${this.report.summary.passedTests}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failure">${this.report.summary.failedTests}</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value">${this.report.summary.successRate.toFixed(1)}%</div>
            </div>
        </div>

        <div class="section">
            <h2>Performance Tests</h2>
            <table>
                <thead>
                    <tr>
                        <th>Endpoint</th>
                        <th>Method</th>
                        <th>Requests</th>
                        <th>Avg Response Time</th>
                        <th>RPS</th>
                        <th>Error Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.report.performanceTests.map(test => `
                        <tr class="${test.errorRate > 5 ? 'failed' : test.errorRate > 0 ? 'warning' : 'success'}">
                            <td>${test.url}</td>
                            <td>${test.method}</td>
                            <td>${test.requests}</td>
                            <td>${test.avgResponseTime.toFixed(2)}ms</td>
                            <td>${test.requestsPerSecond.toFixed(2)}</td>
                            <td>${test.errorRate.toFixed(2)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Security Tests</h2>
            ${this.report.securityTests.map(test => `
                <div class="test-item ${test.passed ? 'success' : 'failed'}">
                    <h4>${test.testType}</h4>
                    <p>${test.description}</p>
                    ${!test.passed ? `<p><strong>Recommendation:</strong> ${test.recommendation}</p>` : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Contract Tests</h2>
            ${this.report.contractTests.map(test => `
                <div class="test-item ${test.success ? 'success' : 'failed'}">
                    <h4>${test.interaction}</h4>
                    <p>Consumer: ${test.consumer} | Provider: ${test.provider}</p>
                    ${!test.success ? `<p><strong>Errors:</strong> ${test.errors?.join(', ')}</p>` : '<p>✓ Contract verified successfully</p>'}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            <div class="recommendations">
                ${this.report.recommendations.length > 0 ? `
                    <ul>
                        ${this.report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                ` : '<p>No recommendations at this time. All tests are performing well!</p>'}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  private generateJUnitContent(): string {
    const totalTests = this.report.summary.totalTests;
    const failures = this.report.summary.failedTests;
    const time = this.report.summary.totalDuration / 1000;

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="API Tests" tests="${totalTests}" failures="${failures}" time="${time}">
    ${this.report.unitTests.map((test, index) => `
    <testcase classname="Unit Tests" name="unit-test-${index}" time="${test.duration / 1000}">
        ${!test.success ? `<failure message="${test.error}">${test.error}</failure>` : ''}
    </testcase>`).join('')}
    
    ${this.report.integrationTests.map((test, index) => `
    <testcase classname="Integration Tests" name="integration-test-${index}" time="${test.duration / 1000}">
        ${!test.success ? `<failure message="${test.error}">${test.error}</failure>` : ''}
    </testcase>`).join('')}
    
    ${this.report.securityTests.map((test, index) => `
    <testcase classname="Security Tests" name="${test.testType}" time="0">
        ${!test.passed ? `<failure message="${test.description}">${test.description}</failure>` : ''}
    </testcase>`).join('')}
    
    ${this.report.contractTests.map((test, index) => `
    <testcase classname="Contract Tests" name="${test.interaction}" time="0">
        ${!test.success ? `<failure message="${test.errors?.join(', ')}">${test.errors?.join(', ')}</failure>` : ''}
    </testcase>`).join('')}
</testsuite>`;
  }

  async generateReport(): Promise<void> {
    const format = this.config.reporting?.format || 'html';
    
    switch (format) {
      case 'html':
        await this.generateHTMLReport();
        break;
      case 'json':
        await this.generateJSONReport();
        break;
      case 'junit':
        await this.generateJUnitReport();
        break;
      default:
        await this.generateHTMLReport();
        await this.generateJSONReport();
        await this.generateJUnitReport();
    }
  }

  getReport(): TestReport {
    return this.report;
  }
}
