import {
  Role,
  Permission,
  UserRole,
  PermissionOverride,
  AuditLog,
  AuditAction,
  PermissionCheck,
  PermissionCheckResult,
  PermissionContext,
  SecurityContext,
  AccessControlDecision,
  PermissionCache,
  RoleHierarchy,
  PermissionInheritanceChain,
  DynamicPermissionRule,
  ResourcePermission,
  RoleType,
  InheritanceType
} from './types';

export class RoleBasedAccessControl {
  private roles: Map<string, Role> = new Map();
  private userRoles: Map<string, UserRole[]> = new Map();
  private permissionOverrides: Map<string, PermissionOverride[]> = new Map();
  private dynamicRules: DynamicPermissionRule[] = [];
  private permissionCache: Map<string, PermissionCache> = new Map();
  private auditLogs: AuditLog[] = [];
  private roleHierarchy: Map<string, RoleHierarchy> = new Map();

  constructor() {
    this.initializeSystem();
  }

  /**
   * Initialize the RBAC system
   */
  private async initializeSystem(): Promise<void> {
    await this.loadRoles();
    await this.loadUserRoles();
    await this.loadPermissionOverrides();
    await this.loadDynamicRules();
    this.buildRoleHierarchy();
    this.startCacheCleanup();
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    userId: string,
    permission: Permission,
    resourceId?: string,
    context?: Record<string, any>
  ): Promise<PermissionCheckResult> {
    const cacheKey = this.generateCacheKey(userId, permission, resourceId, context);
    
    // Check cache first
    const cached = this.permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return {
        granted: cached.permissions.has(permission),
        permission,
        source: 'role',
        reason: 'Permission granted via cached role'
      };
    }

    // Get user's permission context
    const permissionContext = await this.getPermissionContext(userId);
    
    // Check direct overrides first (highest priority)
    const overrideResult = this.checkPermissionOverrides(userId, permission, permissionContext);
    if (overrideResult !== null) {
      this.cachePermissionResult(cacheKey, overrideResult);
      return overrideResult;
    }

    // Check dynamic rules
    const dynamicResult = await this.checkDynamicRules(userId, permission, resourceId, context);
    if (dynamicResult !== null) {
      this.cachePermissionResult(cacheKey, dynamicResult);
      return dynamicResult;
    }

    // Check role-based permissions
    const roleResult = this.checkRolePermissions(userId, permission, permissionContext);
    
    // Cache the result
    this.cachePermissionResult(cacheKey, roleResult);
    
    // Log the permission check
    await this.logPermissionCheck(userId, permission, roleResult);
    
    return roleResult;
  }

  /**
   * Get all effective permissions for a user
   */
  async getEffectivePermissions(userId: string): Promise<Set<Permission>> {
    const permissionContext = await this.getPermissionContext(userId);
    return permissionContext.effectivePermissions;
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: Date
  ): Promise<UserRole> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const userRole: UserRole = {
      id: this.generateId(),
      userId,
      roleId,
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
      isActive: true,
      metadata: {}
    };

    // Add to user roles
    const currentRoles = this.userRoles.get(userId) || [];
    currentRoles.push(userRole);
    this.userRoles.set(userId, currentRoles);

    // Clear permission cache for this user
    this.clearUserPermissionCache(userId);

    // Log the assignment
    await this.logAuditEvent(userId, AuditAction.ASSIGN, 'role', roleId, {
      roleId,
      roleName: role.name,
      assignedBy,
      expiresAt
    });

    return userRole;
  }

  /**
   * Remove a role from a user
   */
  async unassignRole(userId: string, roleId: string, unassignedBy: string): Promise<void> {
    const currentRoles = this.userRoles.get(userId) || [];
    const roleIndex = currentRoles.findIndex(r => r.roleId === roleId);
    
    if (roleIndex === -1) {
      throw new Error(`User ${userId} does not have role ${roleId}`);
    }

    // Remove the role
    currentRoles.splice(roleIndex, 1);
    this.userRoles.set(userId, currentRoles);

    // Clear permission cache
    this.clearUserPermissionCache(userId);

    // Log the unassignment
    await this.logAuditEvent(userId, AuditAction.UNASSIGN, 'role', roleId, {
      roleId,
      unassignedBy
    });
  }

  /**
   * Create a new role
   */
  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const role: Role = {
      ...roleData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.roles.set(role.id, role);
    this.buildRoleHierarchy();

    await this.logAuditEvent(roleData.createdBy, AuditAction.CREATE, 'role', role.id, {
      roleName: role.name,
      roleType: role.type
    });

    return role;
  }

  /**
   * Update an existing role
   */
  async updateRole(
    roleId: string,
    updates: Partial<Role>,
    updatedBy: string
  ): Promise<Role> {
    const existingRole = this.roles.get(roleId);
    if (!existingRole) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const updatedRole: Role = {
      ...existingRole,
      ...updates,
      updatedAt: new Date(),
      updatedBy
    };

    this.roles.set(roleId, updatedRole);
    this.buildRoleHierarchy();

    // Clear all permission caches as role hierarchy changed
    this.clearAllPermissionCaches();

    await this.logAuditEvent(updatedBy, AuditAction.UPDATE, 'role', roleId, {
      roleName: updatedRole.name,
      changes: updates
    });

    return updatedRole;
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    // Check if role is in use
    for (const [userId, userRoles] of this.userRoles) {
      if (userRoles.some(ur => ur.roleId === roleId)) {
        throw new Error(`Cannot delete role ${roleId} - it is assigned to users`);
      }
    }

    this.roles.delete(roleId);
    this.buildRoleHierarchy();
    this.clearAllPermissionCaches();

    await this.logAuditEvent(deletedBy, AuditAction.DELETE, 'role', roleId, {
      roleName: role.name
    });
  }

  /**
   * Add permission override for a user
   */
  async addPermissionOverride(
    userId: string,
    roleId: string,
    permission: Permission,
    granted: boolean,
    reason?: string,
    expiresAt?: Date,
    createdBy: string
  ): Promise<PermissionOverride> {
    const override: PermissionOverride = {
      id: this.generateId(),
      userId,
      roleId,
      permission,
      granted,
      reason,
      expiresAt,
      isTemporary: !!expiresAt,
      createdBy,
      createdAt: new Date()
    };

    const currentOverrides = this.permissionOverrides.get(userId) || [];
    currentOverrides.push(override);
    this.permissionOverrides.set(userId, currentOverrides);

    // Clear permission cache for this user
    this.clearUserPermissionCache(userId);

    await this.logAuditEvent(userId, granted ? AuditAction.PERMISSION_GRANTED : AuditAction.PERMISSION_REVOKED, 'permission_override', override.id, {
      permission,
      granted,
      reason,
      expiresAt
    });

    return override;
  }

  /**
   * Remove permission override
   */
  async removePermissionOverride(
    userId: string,
    overrideId: string,
    removedBy: string
  ): Promise<void> {
    const currentOverrides = this.permissionOverrides.get(userId) || [];
    const overrideIndex = currentOverrides.findIndex(o => o.id === overrideId);
    
    if (overrideIndex === -1) {
      throw new Error(`Permission override not found: ${overrideId}`);
    }

    const removedOverride = currentOverrides[overrideIndex];
    currentOverrides.splice(overrideIndex, 1);
    this.permissionOverrides.set(userId, currentOverrides);

    this.clearUserPermissionCache(userId);

    await this.logAuditEvent(userId, AuditAction.DELETE, 'permission_override', overrideId, {
      permission: removedOverride.permission,
      removedBy
    });
  }

  /**
   * Get role hierarchy for a role
   */
  getRoleHierarchy(roleId: string): RoleHierarchy | null {
    return this.roleHierarchy.get(roleId) || null;
  }

  /**
   * Get all roles in hierarchy order
   */
  getRoleHierarchyTree(): RoleHierarchy[] {
    return Array.from(this.roleHierarchy.values())
      .sort((a, b) => a.depth - b.depth);
  }

  /**
   * Check for permission conflicts in role hierarchy
   */
  async checkPermissionConflicts(roleId: string): Promise<PermissionInheritanceChain> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const inheritedPermissions = await this.getInheritedPermissions(roleId);
    const conflicts: Array<{
      permission: Permission;
      sourceRole: string;
      targetRole: string;
      type: 'conflict' | 'override';
    }> = [];

    // Check for conflicts with parent roles
    const hierarchy = this.getRoleHierarchy(roleId);
    if (hierarchy?.parentRoleId) {
      const parentPermissions = await this.getInheritedPermissions(hierarchy.parentRoleId);
      
      for (const permission of inheritedPermissions) {
        if (parentPermissions.has(permission)) {
          conflicts.push({
            permission,
            sourceRole: hierarchy.parentRoleId,
            targetRole: roleId,
            type: 'conflict'
          });
        }
      }
    }

    return {
      roleId,
      inheritedPermissions,
      inheritedFrom: await this.buildInheritanceChain(roleId),
      conflicts
    };
  }

  /**
   * Create dynamic permission rule
   */
  async createDynamicRule(ruleData: Omit<DynamicPermissionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<DynamicPermissionRule> {
    const rule: DynamicPermissionRule = {
      ...ruleData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dynamicRules.push(rule);
    this.clearAllPermissionCaches();

    await this.logAuditEvent(ruleData.createdBy, AuditAction.CREATE, 'dynamic_rule', rule.id, {
      ruleName: rule.name,
      condition: rule.condition
    });

    return rule;
  }

  /**
   * Get user's permission context
   */
  private async getPermissionContext(userId: string): Promise<PermissionContext> {
    const userRoles = this.userRoles.get(userId) || [];
    const activeRoles = userRoles.filter(ur => ur.isActive && (!ur.expiresAt || ur.expiresAt > new Date()));
    
    // Get all permissions from roles
    const rolePermissions = new Set<Permission>();
    const inheritedFrom: Array<{roleId: string; roleName: string; permissions: Permission[]}> = [];

    for (const userRole of activeRoles) {
      const role = this.roles.get(userRole.roleId);
      if (role) {
        const inherited = await this.getInheritedPermissions(userRole.roleId);
        inherited.forEach(p => rolePermissions.add(p));
        
        inheritedFrom.push({
          roleId: role.id,
          roleName: role.name,
          permissions: role.permissions
        });
      }
    }

    // Apply permission overrides
    const overrides = this.permissionOverrides.get(userId) || [];
    const effectivePermissions = new Set(rolePermissions);

    for (const override of overrides) {
      if (!override.expiresAt || override.expiresAt > new Date()) {
        if (override.granted) {
          effectivePermissions.add(override.permission);
        } else {
          effectivePermissions.delete(override.permission);
        }
      }
    }

    return {
      userId,
      roles: activeRoles.map(ur => this.roles.get(ur.roleId)!),
      permissions: Array.from(effectivePermissions),
      overrides,
      effectivePermissions,
      lastCalculated: new Date()
    };
  }

  /**
   * Check permission overrides for a user
   */
  private checkPermissionOverrides(
    userId: string,
    permission: Permission,
    context: PermissionContext
  ): PermissionCheckResult | null {
    const overrides = this.permissionOverrides.get(userId) || [];
    const activeOverrides = overrides.filter(o => 
      o.permission === permission && 
      (!o.expiresAt || o.expiresAt > new Date())
    );

    if (activeOverrides.length === 0) {
      return null;
    }

    // The most recent override takes precedence
    const latestOverride = activeOverrides.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return {
      granted: latestOverride.granted,
      permission,
      source: 'override',
      reason: `Permission ${latestOverride.granted ? 'granted' : 'denied'} via override: ${latestOverride.reason}`,
      expiresAt: latestOverride.expiresAt
    };
  }

  /**
   * Check dynamic rules for a permission
   */
  private async checkDynamicRules(
    userId: string,
    permission: Permission,
    resourceId?: string,
    context?: Record<string, any>
  ): Promise<PermissionCheckResult | null> {
    const applicableRules = this.dynamicRules.filter(rule => 
      rule.isActive && 
      rule.permissions.includes(permission)
    ).sort((a, b) => b.priority - a.priority);

    if (applicableRules.length === 0) {
      return null;
    }

    // Evaluate rules in priority order
    for (const rule of applicableRules) {
      try {
        const result = this.evaluateRuleCondition(rule.condition, {
          userId,
          permission,
          resourceId,
          context,
          timestamp: new Date()
        });

        if (result) {
          return {
            granted: true,
            permission,
            source: 'dynamic_rule',
            reason: `Permission granted via dynamic rule: ${rule.name}`
          };
        }
      } catch (error) {
        console.error(`Error evaluating dynamic rule ${rule.id}:`, error);
      }
    }

    return null;
  }

  /**
   * Check role-based permissions
   */
  private checkRolePermissions(
    userId: string,
    permission: Permission,
    context: PermissionContext
  ): PermissionCheckResult {
    const hasPermission = context.effectivePermissions.has(permission);
    
    return {
      granted: hasPermission,
      permission,
      source: 'role',
      reason: hasPermission ? 
        `Permission granted via role assignment` : 
        `Permission not granted - user lacks required role`
    };
  }

  /**
   * Get inherited permissions for a role
   */
  private async getInheritedPermissions(roleId: string): Promise<Set<Permission>> {
    const role = this.roles.get(roleId);
    if (!role) {
      return new Set();
    }

    const permissions = new Set(role.permissions);

    if (role.inheritanceType === InheritanceType.NONE) {
      return permissions;
    }

    const hierarchy = this.roleHierarchy.get(roleId);
    if (!hierarchy) {
      return permissions;
    }

    // Add permissions from parent roles based on inheritance type
    if (hierarchy.parentRoleId) {
      const parentPermissions = await this.getInheritedPermissions(hierarchy.parentRoleId);
      
      switch (role.inheritanceType) {
        case InheritanceType.SIMPLE:
          parentPermissions.forEach(p => permissions.add(p));
          break;
        case InheritanceType.COMPLEX:
          // Only add specific parent permissions based on role metadata
          const inheritedFromParent = role.metadata.inheritFromParent || [];
          inheritedFromParent.forEach((p: Permission) => {
            if (parentPermissions.has(p)) {
              permissions.add(p);
            }
          });
          break;
        case InheritanceType.DYNAMIC:
          // Evaluate dynamic inheritance conditions
          if (this.evaluateInheritanceCondition(role, hierarchy)) {
            parentPermissions.forEach(p => permissions.add(p));
          }
          break;
      }
    }

    return permissions;
  }

  /**
   * Build inheritance chain for a role
   */
  private async buildInheritanceChain(roleId: string): Promise<Array<{
    roleId: string;
    roleName: string;
    permissions: Permission[];
  }>> {
    const chain: Array<{roleId: string; roleName: string; permissions: Permission[]}> = [];
    const visited = new Set<string>();
    
    await this.buildInheritanceChainRecursive(roleId, chain, visited);
    return chain;
  }

  /**
   * Recursively build inheritance chain
   */
  private async buildInheritanceChainRecursive(
    roleId: string,
    chain: Array<{roleId: string; roleName: string; permissions: Permission[]}>,
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(roleId)) {
      return; // Prevent circular inheritance
    }

    visited.add(roleId);
    const role = this.roles.get(roleId);
    if (!role) {
      return;
    }

    chain.push({
      roleId: role.id,
      roleName: role.name,
      permissions: role.permissions
    });

    const hierarchy = this.roleHierarchy.get(roleId);
    if (hierarchy?.parentRoleId) {
      await this.buildInheritanceChainRecursive(hierarchy.parentRoleId, chain, visited);
    }
  }

  /**
   * Build role hierarchy
   */
  private buildRoleHierarchy(): void {
    this.roleHierarchy.clear();

    for (const role of this.roles.values()) {
      const hierarchy: RoleHierarchy = {
        roleId: role.id,
        parentRoleId: role.parentRoleId,
        childRoleIds: role.childRoleIds || [],
        depth: 0,
        path: []
      };

      this.roleHierarchy.set(role.id, hierarchy);
    }

    // Calculate depths and paths
    for (const role of this.roles.values()) {
      const hierarchy = this.roleHierarchy.get(role.id)!;
      const { depth, path } = this.calculateRoleDepth(role.id);
      hierarchy.depth = depth;
      hierarchy.path = path;
    }
  }

  /**
   * Calculate role depth in hierarchy
   */
  private calculateRoleDepth(roleId: string): { depth: number; path: string[] } {
    const visited = new Set<string>();
    const path: string[] = [];
    
    const calculateDepthRecursive = (currentRoleId: string): number => {
      if (visited.has(currentRoleId)) {
        return -1; // Circular reference
      }

      visited.add(currentRoleId);
      const role = this.roles.get(currentRoleId);
      if (!role) {
        return 0;
      }

      path.push(currentRoleId);

      if (!role.parentRoleId) {
        return 0;
      }

      const parentDepth = calculateDepthRecursive(role.parentRoleId);
      return parentDepth >= 0 ? parentDepth + 1 : -1;
    };

    const depth = calculateDepthRecursive(roleId);
    return { depth: Math.max(0, depth), path };
  }

  /**
   * Evaluate rule condition safely
   */
  private evaluateRuleCondition(condition: string, context: any): boolean {
    try {
      // Create a safe evaluation context
      const evalContext = {
        userId: context.userId,
        permission: context.permission,
        resourceId: context.resourceId,
        context: context.context,
        timestamp: context.timestamp,
        // Add safe utility functions
        date: new Date(),
        hour: new Date().getHours(),
        day: new Date().getDay(),
        Math: Math,
        parseInt: parseInt,
        parseFloat: parseFloat
      };

      // Evaluate the condition
      const func = new Function('context', `
        with(context) {
          try {
            return ${condition};
          } catch (error) {
            return false;
          }
        }
      `);

      return func(evalContext);
    } catch (error) {
      console.error('Error evaluating rule condition:', error);
      return false;
    }
  }

  /**
   * Evaluate inheritance condition
   */
  private evaluateInheritanceCondition(role: Role, hierarchy: RoleHierarchy): boolean {
    const condition = role.metadata.inheritanceCondition;
    if (!condition) {
      return true;
    }

    try {
      const context = {
        role,
        hierarchy,
        parentRole: hierarchy.parentRoleId ? this.roles.get(hierarchy.parentRoleId) : null,
        timestamp: new Date()
      };

      return this.evaluateRuleCondition(condition, context);
    } catch (error) {
      console.error('Error evaluating inheritance condition:', error);
      return false;
    }
  }

  /**
   * Cache permission result
   */
  private cachePermissionResult(cacheKey: string, result: PermissionCheckResult): void {
    this.permissionCache.set(cacheKey, {
      userId: cacheKey.split(':')[0],
      permissions: new Set([result.permission]),
      contextHash: cacheKey,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      calculatedAt: new Date()
    });
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    userId: string,
    permission: Permission,
    resourceId?: string,
    context?: Record<string, any>
  ): string {
    const contextHash = context ? JSON.stringify(context) : '';
    return `${userId}:${permission}:${resourceId || ''}:${contextHash}`;
  }

  /**
   * Clear permission cache for a user
   */
  private clearUserPermissionCache(userId: string): void {
    for (const [key, cache] of this.permissionCache) {
      if (cache.userId === userId) {
        this.permissionCache.delete(key);
      }
    }
  }

  /**
   * Clear all permission caches
   */
  private clearAllPermissionCaches(): void {
    this.permissionCache.clear();
  }

  /**
   * Start cache cleanup timer
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = new Date();
      for (const [key, cache] of this.permissionCache) {
        if (cache.expiresAt <= now) {
          this.permissionCache.delete(key);
        }
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Log permission check
   */
  private async logPermissionCheck(
    userId: string,
    permission: Permission,
    result: PermissionCheckResult
  ): Promise<void> {
    const check: PermissionCheck = {
      userId,
      permission,
      resourceId: undefined,
      context: {},
      checkTime: new Date(),
      result: result.granted,
      reason: result.reason,
      source: result.source
    };

    this.auditLogs.push({
      id: this.generateId(),
      userId,
      action: result.granted ? AuditAction.READ : AuditAction.ACCESS_DENIED,
      resource: 'permission',
      resourceId: permission,
      details: {
        permission,
        result: result.granted,
        source: result.source,
        reason: result.reason
      },
      ipAddress: '', // Would be filled by middleware
      userAgent: '', // Would be filled by middleware
      timestamp: new Date(),
      success: result.granted
    });
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId: string,
    details: Record<string, any>
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: this.generateId(),
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress: '', // Would be filled by middleware
      userAgent: '', // Would be filled by middleware
      timestamp: new Date(),
      success: true
    };

    this.auditLogs.push(auditLog);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Public methods for data access
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async getRole(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) || null;
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return this.userRoles.get(userId) || [];
  }

  async getPermissionOverrides(userId: string): Promise<PermissionOverride[]> {
    return this.permissionOverrides.get(userId) || [];
  }

  async getAuditLogs(userId?: string, limit?: number): Promise<AuditLog[]> {
    let logs = this.auditLogs;
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId);
    }

    if (limit) {
      logs = logs.slice(-limit);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getDynamicRules(): Promise<DynamicPermissionRule[]> {
    return this.dynamicRules;
  }

  // Data loading methods (would connect to actual database)
  private async loadRoles(): Promise<void> {
    // This would load roles from database
    console.log('Loading roles...');
  }

  private async loadUserRoles(): Promise<void> {
    // This would load user roles from database
    console.log('Loading user roles...');
  }

  private async loadPermissionOverrides(): Promise<void> {
    // This would load permission overrides from database
    console.log('Loading permission overrides...');
  }

  private async loadDynamicRules(): Promise<void> {
    // This would load dynamic rules from database
    console.log('Loading dynamic rules...');
  }
}
