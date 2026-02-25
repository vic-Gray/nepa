/**
 * Advanced Security Module
 * Enterprise-level API security with MFA, API Keys, Request Signing, and more
 * 
 * All features are:
 * - Additive (non-breaking)
 * - Feature-flag enabled via environment variables
 * - Backward compatible with existing auth system
 */

import { securityConfig } from './SecurityConfig';

// Import modules
import * as MfaModule from './modules/MfaModule';
import * as ApiKeyModule from './modules/ApiKeyModule';
import AuditLoggerService from './modules/AuditLoggerService';
import { auditLogger } from './modules/AuditLoggerService';
import SecurityMonitorService from './services/SecurityMonitorService';
import { securityMonitor } from './services/SecurityMonitorService';

// Import middleware
import * as RequestSigning from './middleware/RequestSigning';
import * as InputValidation from './middleware/InputValidation';
import * as WafMiddleware from './middleware/WafMiddleware';

// Re-export everything
export {
  securityConfig,
  securityConfig as SecurityConfig,
  
  // Modules
  MfaModule,
  ApiKeyModule,
  auditLogger,
  AuditLoggerService,
  securityMonitor,
  SecurityMonitorService,
  
  // Middleware
  RequestSigning,
  InputValidation,
  WafMiddleware,
  
  // Common schemas for validation
  InputValidation as Validation,
};

// Default export
export default {
  securityConfig,
  MfaModule,
  ApiKeyModule,
  auditLogger,
  securityMonitor,
  RequestSigning,
  InputValidation,
  WafMiddleware,
};
