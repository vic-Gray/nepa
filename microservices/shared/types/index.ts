// Shared types across microservices

export interface ServiceConfig {
  name: string;
  port: number;
  version: string;
  environment: string;
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  dependencies?: {
    database?: 'UP' | 'DOWN';
    redis?: 'UP' | 'DOWN';
    eventBus?: 'UP' | 'DOWN';
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    service: string;
  };
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface ServiceRegistration {
  serviceId: string;
  serviceName: string;
  host: string;
  port: number;
  healthCheckUrl: string;
  metadata?: Record<string, any>;
}
