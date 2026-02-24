export interface RateLimitTier {
  name: string;
  requestsPerWindow: number;
  windowMs: number;
  burstCapacity?: number;
  priority: number;
  features: RateLimitFeatures;
}

export interface RateLimitFeatures {
  burstHandling: boolean;
  analytics: boolean;
  customRules: boolean;
  endpointSpecific: boolean;
  methodSpecific: boolean;
  roleBased: boolean;
  breachAlerts: boolean;
}

export interface UserRateLimitProfile {
  userId: string;
  tier: RateLimitTier['name'];
  customLimits?: Record<string, number>;
  whitelist: boolean;
  blacklist: boolean;
  metadata: Record<string, any>;
}

export interface EndpointRateLimitRule {
  endpoint: string;
  method?: string;
  userRole?: UserRole;
  tier: RateLimitTier['name'];
  customLimit?: number;
  windowMs?: number;
  burstCapacity?: number;
}

export interface RateLimitMetrics {
  userId?: string;
  ip: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  blocked: boolean;
  remaining: number;
  resetTime: Date;
  tier: string;
  breach?: boolean;
}

export interface RateLimitBreach {
  id: string;
  userId?: string;
  ip: string;
  endpoint: string;
  breachType: 'RATE_LIMIT' | 'BURST' | 'SUSPICIOUS' | 'DDOS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
}

export interface RateLimitAnalytics {
  totalRequests: number;
  blockedRequests: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    blocked: number;
  }>;
  topIPs: Array<{
    ip: string;
    requests: number;
    blocked: number;
  }>;
  tierDistribution: Record<string, number>;
  breachSummary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  timeWindow: {
    start: Date;
    end: Date;
  };
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum RateLimitTierType {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
  UNLIMITED = 'UNLIMITED'
}
