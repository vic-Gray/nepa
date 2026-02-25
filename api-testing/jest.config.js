module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFiles: ['dotenv/config'],
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'NEPA API Test Report',
        outputPath: './test-reports/test-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-reports',
        outputName: 'junit.xml',
      }
    ]
  ],
  testTimeout: 30000
};