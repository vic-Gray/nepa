export enum Permission {
  // User Management
  USER_READ = 'user:read',
  USER_WRITE = 'user:write',
  USER_DELETE = 'user:delete',
  USER_CREATE = 'user:create',
  
  // Role Management
  ROLE_READ = 'role:read',
  ROLE_WRITE = 'role:write',
  ROLE_DELETE = 'role:delete',
  ROLE_CREATE = 'role:create',
  ROLE_ASSIGN = 'role:assign',
  ROLE_UNASSIGN = 'role:unassign',
  
  // Permission Management
  PERMISSION_READ = 'permission:read',
  PERMISSION_WRITE = 'permission:write',
  PERMISSION_DELETE = 'permission:delete',
  PERMISSION_CREATE = 'permission:create',
  
  // Billing Management
  BILL_READ = 'bill:read',
  BILL_WRITE = 'bill:write',
  BILL_DELETE = 'bill:delete',
  BILL_CREATE = 'bill:create',
  BILL_PAY = 'bill:pay',
  
  // Payment Management
  PAYMENT_READ = 'payment:read',
  PAYMENT_WRITE = 'payment:write',
  PAYMENT_DELETE = 'payment:delete',
  PAYMENT_PROCESS = 'payment:process',
  PAYMENT_REFUND = 'payment:refund',
  
  // Blockchain Management
  BLOCKCHAIN_READ = 'blockchain:read',
  BLOCKCHAIN_WRITE = 'blockchain:write',
  BLOCKCHAIN_MANAGE = 'blockchain:manage',
  
  // Fraud Detection
  FRAUD_READ = 'fraud:read',
  FRAUD_WRITE = 'fraud:write',
  FRAUD_REVIEW = 'fraud:review',
  FRAUD_INVESTIGATE = 'fraud:investigate',
  
  // Backup Management
  BACKUP_READ = 'backup:read',
  BACKUP_CREATE = 'backup:create',
  BACKUP_RESTORE = 'backup:restore',
  BACKUP_DELETE = 'backup:delete',
  
  // System Administration
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_MAINTENANCE = 'system:maintenance',
  
  // Audit Management
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',
  AUDIT_DELETE = 'audit:delete',
  
  // Analytics
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',
  
  // API Access
  API_ACCESS = 'api:access',
  API_ADMIN = 'api:admin',
  
  // Reports
  REPORTS_READ = 'reports:read',
  REPORTS_CREATE = 'reports:create',
  REPORTS_EXPORT = 'reports:export'
}

export enum RoleType {
  SYSTEM = 'system',
  ORGANIZATION = 'organization',
  CUSTOM = 'custom',
  TEMPORARY = 'temporary'
}

export enum PermissionType {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  CREATE = 'create',
  ADMIN = 'admin'
}

export enum InheritanceType {
  NONE = 'none',
  SIMPLE = 'simple',
  COMPLEX = 'complex',
  DYNAMIC = 'dynamic'
}

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  ASSIGN = 'assign',
  UNASSIGN = 'unassign',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ACCESS_DENIED = 'access_denied',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked'
}

export interface Role {
  id: string;
  name: string;
  description: string;
  type: RoleType;
  permissions: Permission[];
  parentRoleId?: string;
  childRoleIds: string[];
  inheritanceType: InheritanceType;
  isActive: boolean;
  priority: number; // Higher number = higher priority
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface PermissionOverride {
  id: string;
  userId: string;
  roleId: string;
  permission: Permission;
  granted: boolean; // true = grant, false = deny
  reason?: string;
  expiresAt?: Date;
  isTemporary: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface PermissionCheck {
  userId: string;
  permission: Permission;
  resourceId?: string;
  context?: Record<string, any>;
  checkTime: Date;
  result: boolean;
  reason?: string;
  source: string; // 'role', 'override', 'direct'
}

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  sessionId?: string;
}

export interface PermissionContext {
  userId: string;
  roles: Role[];
  permissions: Permission[];
  overrides: PermissionOverride[];
  effectivePermissions: Set<Permission>;
  lastCalculated: Date;
}

export interface AccessRequest {
  id: string;
  userId: string;
  requestedPermission: Permission;
  resourceId?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedBy: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface RoleAssignmentWorkflow {
  id: string;
  roleId: string;
  userId: string;
  requestedBy: string;
  currentAssignments: UserRole[];
  proposedAssignment: UserRole;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approvalSteps: ApprovalStep[];
  currentStep: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface ApprovalStep {
  id: string;
  name: string;
  description: string;
  requiredRole: string;
  approverId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approvedAt?: Date;
  comments?: string;
}

export interface PermissionMatrix {
  roles: Role[];
  permissions: Permission[];
  rolePermissions: Map<string, Permission[]>;
  userRoles: Map<string, string[]>;
  permissionOverrides: Map<string, PermissionOverride[]>;
  lastUpdated: Date;
}

export interface DynamicPermissionRule {
  id: string;
  name: string;
  description: string;
  condition: string; // JavaScript expression for evaluation
  permissions: Permission[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ResourcePermission {
  id: string;
  resourceType: string;
  resourceId: string;
  permission: Permission;
  conditions: {
    userId?: string[];
    roleIds?: string[];
    timeRestrictions?: {
      startHour?: number;
      endHour?: number;
      daysOfWeek?: number[];
    };
    ipRestrictions?: string[];
    locationRestrictions?: string[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionCheckResult {
  granted: boolean;
  permission: Permission;
  source: 'role' | 'override' | 'direct' | 'dynamic_rule';
  reason?: string;
  expiresAt?: Date;
  conditions?: string[];
}

export interface RoleHierarchy {
  roleId: string;
  parentRoleId?: string;
  childRoleIds: string[];
  depth: number;
  path: string[];
}

export interface PermissionInheritanceChain {
  roleId: string;
  inheritedPermissions: Permission[];
  inheritedFrom: Array<{
    roleId: string;
    roleName: string;
    permissions: Permission[];
  }>;
  conflicts: Array<{
    permission: Permission;
    sourceRole: string;
    targetRole: string;
    type: 'conflict' | 'override';
  }>;
}

export interface SecurityContext {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  location?: {
    country: string;
    city: string;
    coordinates?: [number, number];
  };
  device?: {
    fingerprint: string;
    trusted: boolean;
  };
}

export interface AccessControlDecision {
  allow: boolean;
  permission: Permission;
  reason: string;
  source: string;
  context: SecurityContext;
  cacheExpiry?: Date;
}

export interface PermissionCache {
  userId: string;
  permissions: Set<Permission>;
  contextHash: string;
  expiresAt: Date;
  calculatedAt: Date;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  type: RoleType;
  permissions: Permission[];
  inheritanceType: InheritanceType;
  metadata: Record<string, any>;
  isSystem: boolean;
  usageCount: number;
  lastUsed?: Date;
}

export interface BulkRoleAssignment {
  userIds: string[];
  roleId: string;
  assignedBy: string;
  reason?: string;
  expiresAt?: Date;
  notifyUsers: boolean;
}

export interface PermissionReport {
  userId: string;
  effectivePermissions: Permission[];
  rolePermissions: Array<{
    roleId: string;
    roleName: string;
    permissions: Permission[];
  }>;
  overrides: Array<{
    permission: Permission;
    granted: boolean;
    reason: string;
    expiresAt?: Date;
  }>;
  generatedAt: Date;
  validUntil: Date;
}

export interface SecurityEvent {
  id: string;
  type: 'permission_denied' | 'unauthorized_access' | 'privilege_escalation' | 'role_change' | 'permission_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  details: Record<string, any>;
  context: SecurityContext;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}
