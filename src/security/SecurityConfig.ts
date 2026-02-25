/**
 * Security Configuration
 * Centralized security settings with environment-based configuration
 * All features are feature-flagged for backward compatibility
 */

export interface SecurityConfig {
  // MFA Configuration
  mfa: {
    enabled: boolean;
    issuer: string;
    windowSize: number; // Time step window for TOTP
    backupCodesCount: number;
    rateLimitMaxAttempts: number;
    rateLimitWindowMs: number;
  };

  // API Key Configuration
  apiKey: {
    enabled: boolean;
    keyLength: number;
    hashAlgorithm: 'sha256' | 'sha512' | 'argon2';
    defaultExpirationDays: number;
    maxKeysPerUser: number;
    requireScope: boolean;
  };

  // Request Signing Configuration
  requestSigning: {
    enabled: boolean;
    algorithm: 'hmac-sha256' | 'hmac-sha384' | 'hmac-sha512';
    timestampToleranceMs: number;
    requireSignature: boolean;
  };

  // Payload Encryption Configuration
  payloadEncryption: {
    enabled: boolean;
    algorithm: 'aes-256-gcm';
    keyRotationDays: number;
  };

  // Rate Limiting Configuration
  rateLimiting: {
    enabled: boolean;
    globalLimit: number;
    globalWindowMs: number;
    perUserLimit: number;
    perUserWindowMs: number;
    perIpLimit: number;
    perIpWindowMs: number;
    strictAuthLimits: boolean;
    strictMfaLimits: boolean;
    useRedis: boolean;
  };

  // Security Monitoring Configuration
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    alertOnSuspiciousActivity: boolean;
    failedLoginThreshold: number;
    failedLoginWindowMs: number;
    tokenAbuseThreshold: number;
    ipAnomalyDetection: boolean;
    geoLocationCheck: boolean;
  };

  // Audit Logging Configuration
  auditLog: {
    enabled: boolean;
    logAuthAttempts: boolean;
    logMfaEvents: boolean;
    logApiKeyCreation: boolean;
    logPermissionFailures: boolean;
    logSuspiciousActivity: boolean;
    excludeSensitiveData: boolean;
    retentionDays: number;
  };

  // Compliance Configuration
  compliance: {
    strictHeaders: boolean;
    corsOrigins: string[];
    corsCredentials: boolean;
    hstsMaxAge: number;
    cspDirectives: Record<string, string>;
    trustProxy: boolean;
  };

  // WAF Integration Configuration
  waf: {
    enabled: boolean;
    provider: 'cloudflare' | 'aws-waf' | 'custom';
    detectBlockedRequests: boolean;
    logWafEvents: boolean;
  };
}

const defaultConfig: SecurityConfig = {
  mfa: {
    enabled: true,
    issuer: process.env.MFA_ISSUER || 'NEPA',
    windowSize: 1,
    backupCodesCount: 10,
    rateLimitMaxAttempts: 5,
    rateLimitWindowMs: 5 * 60 * 1000, // 5 minutes
  },
  apiKey: {
    enabled: true,
    keyLength: 32, // 256 bits
    hashAlgorithm: 'sha256',
    defaultExpirationDays: 90,
    maxKeysPerUser: 10,
    requireScope: true,
  },
  requestSigning: {
    enabled: false,
    algorithm: 'hmac-sha256',
    timestampToleranceMs: 5 * 60 * 1000, // 5 minutes
    requireSignature: false,
  },
  payloadEncryption: {
    enabled: false,
    algorithm: 'aes-256-gcm',
    keyRotationDays: 30,
  },
  rateLimiting: {
    enabled: true,
    globalLimit: 1000,
    globalWindowMs: 15 * 60 * 1000,
    perUserLimit: 500,
    perUserWindowMs: 15 * 60 * 1000,
    perIpLimit: 100,
    perIpWindowMs: 15 * 60 * 1000,
    strictAuthLimits: true,
    strictMfaLimits: true,
    useRedis: true,
  },
  monitoring: {
    enabled: true,
    logLevel: 'info',
    alertOnSuspiciousActivity: true,
    failedLoginThreshold: 5,
    failedLoginWindowMs: 15 * 60 * 1000,
    tokenAbuseThreshold: 100,
    ipAnomalyDetection: true,
    geoLocationCheck: false,
  },
  auditLog: {
    enabled: true,
    logAuthAttempts: true,
    logMfaEvents: true,
    logApiKeyCreation: true,
    logPermissionFailures: true,
    logSuspiciousActivity: true,
    excludeSensitiveData: true,
    retentionDays: 365,
  },
  compliance: {
    strictHeaders: true,
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
    corsCredentials: true,
    hstsMaxAge: 31536000,
    cspDirectives: {
      'default-src': "'self'",
      'script-src': "'self'",
      'style-src': "'self' 'unsafe-inline'",
      'img-src': "'self' data: https:",
      'font-src': "'self'",
      'connect-src': "'self'",
      'frame-ancestors': "'none'",
    },
    trustProxy: true,
  },
  waf: {
    enabled: false,
    provider: 'custom',
    detectBlockedRequests: true,
    logWafEvents: true,
  },
};

// Load configuration from environment with feature flags
export const securityConfig: SecurityConfig = {
  mfa: {
    enabled: process.env.SECURITY_MFA_ENABLED !== 'false',
    issuer: process.env.MFA_ISSUER || defaultConfig.mfa.issuer,
    windowSize: parseInt(process.env.MFA_WINDOW_SIZE || '1', 10),
    backupCodesCount: parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10', 10),
    rateLimitMaxAttempts: parseInt(process.env.MFA_RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
    rateLimitWindowMs: parseInt(process.env.MFA_RATE_LIMIT_WINDOW_MS || '300000', 10),
  },
  apiKey: {
    enabled: process.env.SECURITY_API_KEY_ENABLED !== 'false',
    keyLength: parseInt(process.env.API_KEY_LENGTH || '32', 10),
    hashAlgorithm: (process.env.API_KEY_HASH_ALGORITHM || 'sha256') as 'sha256' | 'sha512' | 'argon2',
    defaultExpirationDays: parseInt(process.env.API_KEY_EXPIRATION_DAYS || '90', 10),
    maxKeysPerUser: parseInt(process.env.API_KEY_MAX_PER_USER || '10', 10),
    requireScope: process.env.API_KEY_REQUIRE_SCOPE !== 'false',
  },
  requestSigning: {
    enabled: process.env.SECURITY_REQUEST_SIGNING_ENABLED === 'true',
    algorithm: (process.env.SECURITY_SIGNING_ALGORITHM || 'hmac-sha256') as 'hmac-sha256' | 'hmac-sha384' | 'hmac-sha512',
    timestampToleranceMs: parseInt(process.env.SECURITY_TIMESTAMP_TOLERANCE_MS || '300000', 10),
    requireSignature: process.env.SECURITY_REQUIRE_SIGNATURE === 'true',
  },
  payloadEncryption: {
    enabled: process.env.SECURITY_PAYLOAD_ENCRYPTION_ENABLED === 'true',
    algorithm: 'aes-256-gcm',
    keyRotationDays: parseInt(process.env.SECURITY_KEY_ROTATION_DAYS || '30', 10),
  },
  rateLimiting: {
    enabled: process.env.SECURITY_RATE_LIMITING_ENABLED !== 'false',
    globalLimit: parseInt(process.env.RATE_LIMIT_GLOBAL || '1000', 10),
    globalWindowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || '900000', 10),
    perUserLimit: parseInt(process.env.RATE_LIMIT_PER_USER || '500', 10),
    perUserWindowMs: parseInt(process.env.RATE_LIMIT_PER_USER_WINDOW_MS || '900000', 10),
    perIpLimit: parseInt(process.env.RATE_LIMIT_PER_IP || '100', 10),
    perIpWindowMs: parseInt(process.env.RATE_LIMIT_PER_IP_WINDOW_MS || '900000', 10),
    strictAuthLimits: process.env.SECURITY_STRICT_AUTH_LIMITS !== 'false',
    strictMfaLimits: process.env.SECURITY_STRICT_MFA_LIMITS !== 'false',
    useRedis: process.env.REDIS_URL !== undefined,
  },
  monitoring: {
    enabled: process.env.SECURITY_MONITORING_ENABLED !== 'false',
    logLevel: (process.env.SECURITY_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    alertOnSuspiciousActivity: process.env.SECURITY_ALERT_ON_SUSPICIOUS !== 'false',
    failedLoginThreshold: parseInt(process.env.SECURITY_FAILED_LOGIN_THRESHOLD || '5', 10),
    failedLoginWindowMs: parseInt(process.env.SECURITY_FAILED_LOGIN_WINDOW_MS || '900000', 10),
    tokenAbuseThreshold: parseInt(process.env.SECURITY_TOKEN_ABUSE_THRESHOLD || '100', 10),
    ipAnomalyDetection: process.env.SECURITY_IP_ANOMALY_DETECTION !== 'false',
    geoLocationCheck: process.env.SECURITY_GEO_LOCATION_CHECK === 'true',
  },
  auditLog: {
    enabled: process.env.SECURITY_AUDIT_LOG_ENABLED !== 'false',
    logAuthAttempts: process.env.SECURITY_LOG_AUTH_ATTEMPTS !== 'false',
    logMfaEvents: process.env.SECURITY_LOG_MFA_EVENTS !== 'false',
    logApiKeyCreation: process.env.SECURITY_LOG_API_KEY_CREATION !== 'false',
    logPermissionFailures: process.env.SECURITY_LOG_PERMISSION_FAILURES !== 'false',
    logSuspiciousActivity: process.env.SECURITY_LOG_SUSPICIOUS_ACTIVITY !== 'false',
    excludeSensitiveData: process.env.SECURITY_EXCLUDE_SENSITIVE_DATA !== 'false',
    retentionDays: parseInt(process.env.SECURITY_AUDIT_RETENTION_DAYS || '365', 10),
  },
  compliance: {
    strictHeaders: process.env.SECURITY_STRICT_HEADERS !== 'false',
    corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
    corsCredentials: process.env.CORS_CREDENTIALS !== 'false',
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10),
    cspDirectives: {
      'default-src': process.env.CSP_DEFAULT_SRC || "'self'",
      'script-src': process.env.CSP_SCRIPT_SRC || "'self'",
      'style-src': process.env.CSP_STYLE_SRC || "'self' 'unsafe-inline'",
      'img-src': process.env.CSP_IMG_SRC || "'self' data: https:",
      'font-src': process.env.CSP_FONT_SRC || "'self'",
      'connect-src': process.env.CSP_CONNECT_SRC || "'self'",
      'frame-ancestors': process.env.CSP_FRAME_ANCESTORS || "'none'",
    },
    trustProxy: process.env.TRUST_PROXY !== 'false',
  },
  waf: {
    enabled: process.env.WAF_ENABLED === 'true',
    provider: (process.env.WAF_PROVIDER || 'custom') as 'cloudflare' | 'aws-waf' | 'custom',
    detectBlockedRequests: process.env.WAF_DETECT_BLOCKED !== 'false',
    logWafEvents: process.env.WAF_LOG_EVENTS !== 'false',
  },
};

export default securityConfig;
