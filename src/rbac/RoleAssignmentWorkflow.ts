import {
  Role,
  UserRole,
  User,
  Permission,
  RoleAssignmentWorkflow,
  ApprovalStep,
  AuditAction,
  RoleType
} from './types';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  approverRole: string;
  requiredApprovals: number;
  currentApprovals: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'skipped';
  approvers: string[];
  deadline?: Date;
  completedAt?: Date;
}

export interface AssignmentRequest {
  id: string;
  userId: string;
  roleId: string;
  requestedBy: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  temporary: boolean;
  expiresAt?: Date;
  metadata: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  stepId: string;
  requester: string;
  approver: string;
  action: 'approve' | 'reject';
  comments?: string;
  timestamp: Date;
}

export class RoleAssignmentWorkflow {
  private workflows: Map<string, RoleAssignmentWorkflow> = new Map();
  private pendingRequests: Map<string, AssignmentRequest> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private workflowSteps: Map<string, WorkflowStep[]> = new Map();

  constructor() {
    this.initializeWorkflow();
  }

  /**
   * Initialize the workflow system
   */
  private async initializeWorkflow(): Promise<void> {
    await this.loadWorkflows();
    await this.loadPendingRequests();
    await this.loadApprovalRequests();
    this.startDeadlineMonitoring();
    this.startNotificationSystem();
  }

  /**
   * Create role assignment workflow
   */
  async createWorkflow(
    roleId: string,
    roleName: string,
    roleType: RoleType,
    approvalSteps: Omit<ApprovalStep, 'id' | 'status' | 'approvedAt' | 'comments'>[]
  ): Promise<RoleAssignmentWorkflow> {
    const workflowId = this.generateId();
    
    const steps: ApprovalStep[] = approvalSteps.map((step, index) => ({
      ...step,
      id: this.generateId(),
      status: 'pending'
    }));

    const workflow: RoleAssignmentWorkflow = {
      id: workflowId,
      roleId,
      userId: '', // Will be set when workflow is initiated
      requestedBy: '',
      currentAssignments: [],
      proposedAssignment: {} as UserRole,
      status: 'pending',
      approvalSteps: steps,
      currentStep: 0,
      createdAt: new Date()
    };

    this.workflows.set(workflowId, workflow);
    
    // Create workflow steps
    const workflowSteps: WorkflowStep[] = steps.map((step, index) => ({
      id: step.id,
      name: step.name,
      description: step.description,
      approverRole: step.requiredRole,
      requiredApprovals: this.getRequiredApprovals(roleType, index),
      currentApprovals: 0,
      status: 'pending',
      approvers: [],
      deadline: this.calculateDeadline(index, steps.length)
    }));

    this.workflowSteps.set(workflowId, workflowSteps);

    await this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Initiate role assignment workflow
   */
  async initiateWorkflow(
    workflowId: string,
    userId: string,
    roleId: string,
    requestedBy: string,
    reason: string,
    expiresAt?: Date
  ): Promise<RoleAssignmentWorkflow> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const role = await this.getRole(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    // Create proposed assignment
    const proposedAssignment: UserRole = {
      id: this.generateId(),
      userId,
      roleId,
      assignedBy: requestedBy,
      assignedAt: new Date(),
      expiresAt,
      isActive: true,
      metadata: {
        workflowId,
        reason,
        initiatedAt: new Date()
      }
    };

    // Update workflow
    workflow.userId = userId;
    workflow.requestedBy = requestedBy;
    workflow.proposedAssignment = proposedAssignment;
    workflow.status = 'pending';
    workflow.currentStep = 0;

    // Start first step
    await this.startWorkflowStep(workflowId, 0);

    await this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Process approval request
   */
  async processApproval(
    workflowId: string,
    stepId: string,
    approverId: string,
    action: 'approve' | 'reject',
    comments?: string
  ): Promise<RoleAssignmentWorkflow> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const steps = this.workflowSteps.get(workflowId);
    if (!steps) {
      throw new Error(`Workflow steps not found: ${workflowId}`);
    }

    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const step = steps[stepIndex];
    
    // Record approval request
    const approvalRequest: ApprovalRequest = {
      id: this.generateId(),
      workflowId,
      stepId,
      requester: workflow.requestedBy,
      approver: approverId,
      action,
      comments,
      timestamp: new Date()
    };

    this.approvalRequests.set(approvalRequest.id, approvalRequest);

    // Update step status
    if (action === 'approve') {
      step.approvers.push(approverId);
      step.currentApprovals++;
      step.status = step.currentApprovals >= step.requiredApprovals ? 'completed' : 'in_progress';
      
      if (step.status === 'completed') {
        step.completedAt = new Date();
      }
    } else {
      step.status = 'rejected';
    }

    // Update workflow step
    steps[stepIndex] = step;
    this.workflowSteps.set(workflowId, steps);

    // Check if workflow can advance
    if (step.status === 'completed') {
      await this.advanceWorkflow(workflowId);
    } else if (step.status === 'rejected') {
      await this.rejectWorkflow(workflowId, stepId, comments);
    }

    await this.saveWorkflow(workflow);
    return workflow;
  }

  /**
   * Advance workflow to next step
   */
  private async advanceWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const steps = this.workflowSteps.get(workflowId);
    if (!steps) return;

    const currentStepIndex = workflow.currentStep;
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < steps.length) {
      // Start next step
      workflow.currentStep = nextStepIndex;
      await this.startWorkflowStep(workflowId, nextStepIndex);
    } else {
      // All steps completed - complete workflow
      await this.completeWorkflow(workflowId);
    }
  }

  /**
   * Reject workflow
   */
  private async rejectWorkflow(workflowId: string, rejectedStepId: string, reason?: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'rejected';
    
    // Log the rejection
    await this.logWorkflowEvent(workflowId, 'rejected', {
      rejectedStepId,
      reason
    });
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'completed';
    workflow.completedAt = new Date();

    // Execute the role assignment
    await this.executeRoleAssignment(workflow);

    // Log completion
    await this.logWorkflowEvent(workflowId, 'completed');
  }

  /**
   * Execute the actual role assignment
   */
  private async executeRoleAssignment(workflow: RoleAssignmentWorkflow): Promise<void> {
    if (!workflow.proposedAssignment) return;

    try {
      // This would call the RBAC service to assign the role
      console.log(`Executing role assignment: ${workflow.proposedAssignment.userId} -> ${workflow.proposedAssignment.roleId}`);
      
      // Notify user and requester
      await this.notifyAssignmentCompleted(workflow);
      
    } catch (error) {
      console.error('Failed to execute role assignment:', error);
      await this.logWorkflowEvent(workflow.id, 'failed', { error: error.message });
    }
  }

  /**
   * Start a specific workflow step
   */
  private async startWorkflowStep(workflowId: string, stepIndex: number): Promise<void> {
    const steps = this.workflowSteps.get(workflowId);
    if (!steps) return;

    const step = steps[stepIndex];
    step.status = 'in_progress';

    // Notify approvers
    await this.notifyStepApprovers(workflowId, step);

    // Log step start
    await this.logWorkflowEvent(workflowId, 'step_started', {
      stepId: step.id,
      stepName: step.name,
      approvers: step.approverRole
    });
  }

  /**
   * Get required approvals based on role type and step
   */
  private getRequiredApprovals(roleType: RoleType, stepIndex: number): number {
    switch (roleType) {
      case RoleType.SYSTEM:
        return 1; // System roles require single approval
      case RoleType.ORGANIZATION:
        return stepIndex === 0 ? 2 : 1; // First step requires 2 approvals, others require 1
      case RoleType.CUSTOM:
        return 1; // Custom roles require single approval
      case RoleType.TEMPORARY:
        return 1; // Temporary roles require single approval
      default:
        return 1;
    }
  }

  /**
   * Calculate deadline for workflow step
   */
  private calculateDeadline(stepIndex: number, totalSteps: number): Date {
    const now = new Date();
    const baseHours = 24; // Base 24 hours per step
    const remainingSteps = totalSteps - stepIndex;
    const totalHours = baseHours * remainingSteps;
    
    return new Date(now.getTime() + totalHours * 60 * 60 * 1000);
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    workflow: RoleAssignmentWorkflow | null;
    steps: WorkflowStep[];
    currentApprovals: ApprovalRequest[];
  }> {
    const workflow = this.workflows.get(workflowId) || null;
    const steps = this.workflowSteps.get(workflowId) || [];
    
    const currentApprovals = Array.from(this.approvalRequests.values())
      .filter(req => req.workflowId === workflowId);

    return {
      workflow,
      steps,
      currentApprovals
    };
  }

  /**
   * Get pending requests for a user
   */
  async getPendingRequests(userId?: string): Promise<AssignmentRequest[]> {
    const requests = Array.from(this.pendingRequests.values());
    
    if (userId) {
      return requests.filter(req => req.userId === userId);
    }
    
    return requests;
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string): Promise<{
    workflows: Array<{
      workflowId: string;
      workflowName: string;
      stepName: string;
      deadline: Date;
      urgency: string;
    }>;
    approvals: ApprovalRequest[];
  }> {
    const userApprovals = Array.from(this.approvalRequests.values())
      .filter(req => req.approver === userId);

    const workflows = new Map<string, any>();

    // Group approvals by workflow
    for (const approval of userApprovals) {
      if (!workflows.has(approval.workflowId)) {
        const workflow = this.workflows.get(approval.workflowId);
        const steps = this.workflowSteps.get(approval.workflowId) || [];
        const currentStep = steps[workflow?.currentStep || 0];
        
        workflows.set(approval.workflowId, {
          workflowId: approval.workflowId,
          workflowName: workflow?.proposedAssignment?.roleId || 'Unknown',
          stepName: currentStep.name,
          deadline: currentStep.deadline || new Date(),
          urgency: 'medium'
        });
      }
    }

    return {
      workflows: Array.from(workflows.values()),
      approvals: userApprovals
    };
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(workflowId: string, cancelledBy: string, reason: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (workflow.status === 'completed') {
      throw new Error('Cannot cancel completed workflow');
    }

    workflow.status = 'rejected';
    
    await this.logWorkflowEvent(workflowId, 'cancelled', {
      cancelledBy,
      reason
    });

    // Notify stakeholders
    await this.notifyWorkflowCancelled(workflow, reason);
  }

  /**
   * Escalate workflow step
   */
  async escalateStep(
    workflowId: string,
    stepId: string,
    escalatedBy: string,
    reason: string
  ): Promise<void> {
    const steps = this.workflowSteps.get(workflowId);
    if (!steps) return;

    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;

    const step = steps[stepIndex];
    
    // Add escalation comment
    await this.logWorkflowEvent(workflowId, 'escalated', {
      stepId,
      escalatedBy,
      reason
    });

    // Notify escalation
    await this.notifyStepEscalated(workflowId, step, reason);
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    rejectedWorkflows: number;
    averageCompletionTime: number;
    averageStepsPerWorkflow: number;
    overdueSteps: number;
    stepStatistics: Record<string, {
      total: number;
      completed: number;
      rejected: number;
      averageTime: number;
    }>;
  }> {
    const workflows = Array.from(this.workflows.values());
    let filteredWorkflows = workflows;

    if (timeRange) {
      filteredWorkflows = workflows.filter(w => 
        w.createdAt >= timeRange.start && w.createdAt <= timeRange.end
      );
    }

    const completed = filteredWorkflows.filter(w => w.status === 'completed');
    const rejected = filteredWorkflows.filter(w => w.status === 'rejected');
    
    const totalCompletionTime = completed.reduce((sum, w) => {
      if (w.completedAt) {
        return sum + (w.completedAt.getTime() - w.createdAt.getTime());
      }
      return sum;
    }, 0);

    const averageCompletionTime = completed.length > 0 ? totalCompletionTime / completed.length : 0;

    const totalSteps = filteredWorkflows.reduce((sum, w) => {
      const steps = this.workflowSteps.get(w.id);
      return sum + (steps?.length || 0);
    }, 0);

    const averageStepsPerWorkflow = filteredWorkflows.length > 0 ? totalSteps / filteredWorkflows.length : 0;

    // Calculate overdue steps
    const now = new Date();
    let overdueSteps = 0;
    for (const workflow of filteredWorkflows) {
      const steps = this.workflowSteps.get(workflow.id) || [];
      for (const step of steps) {
        if (step.deadline && step.deadline < now && step.status !== 'completed') {
          overdueSteps++;
        }
      }
    }

    // Calculate step statistics
    const stepStatistics: Record<string, any> = {};
    for (const workflow of filteredWorkflows) {
      const steps = this.workflowSteps.get(workflow.id) || [];
      for (const step of steps) {
        const stepKey = step.name;
        if (!stepStatistics[stepKey]) {
          stepStatistics[stepKey] = {
            total: 0,
            completed: 0,
            rejected: 0,
            averageTime: 0
          };
        }
        
        stepStatistics[stepKey].total++;
        if (step.status === 'completed') {
          stepStatistics[stepKey].completed++;
        } else if (step.status === 'rejected') {
          stepStatistics[stepKey].rejected++;
        }
      }
    }

    return {
      totalWorkflows: filteredWorkflows.length,
      completedWorkflows: completed.length,
      rejectedWorkflows: rejected.length,
      averageCompletionTime,
      averageStepsPerWorkflow,
      overdueSteps,
      stepStatistics
    };
  }

  // Notification methods
  private async notifyStepApprovers(workflowId: string, step: WorkflowStep): Promise<void> {
    // This would send notifications to users with the approver role
    console.log(`Notifying approvers for step ${step.name} in workflow ${workflowId}`);
  }

  private async notifyAssignmentCompleted(workflow: RoleAssignmentWorkflow): Promise<void> {
    // This would notify the user and requester
    console.log(`Role assignment completed for workflow ${workflow.id}`);
  }

  private async notifyWorkflowCancelled(workflow: RoleAssignmentWorkflow, reason: string): Promise<void> {
    // This would notify relevant parties about cancellation
    console.log(`Workflow ${workflow.id} cancelled: ${reason}`);
  }

  private async notifyStepEscalated(workflowId: string, step: WorkflowStep, reason: string): Promise<void> {
    // This would notify about escalation
    console.log(`Step ${step.name} in workflow ${workflowId} escalated: ${reason}`);
  }

  // Logging methods
  private async logWorkflowEvent(workflowId: string, event: string, details?: any): Promise<void> {
    console.log(`Workflow ${workflowId} event: ${event}`, details);
  }

  // Data persistence methods (would connect to actual database)
  private async saveWorkflow(workflow: RoleAssignmentWorkflow): Promise<void> {
    console.log('Saving workflow:', workflow.id);
  }

  private async loadWorkflows(): Promise<void> {
    console.log('Loading workflows...');
  }

  private async loadPendingRequests(): Promise<void> {
    console.log('Loading pending requests...');
  }

  private async loadApprovalRequests(): Promise<void> {
    console.log('Loading approval requests...');
  }

  // Monitoring methods
  private startDeadlineMonitoring(): void {
    // Check for overdue steps every hour
    setInterval(async () => {
      await this.checkOverdueSteps();
    }, 60 * 60 * 1000); // Every hour
  }

  private async checkOverdueSteps(): Promise<void> {
    const now = new Date();
    
    for (const [workflowId, steps] of this.workflowSteps) {
      for (const step of steps) {
        if (step.deadline && step.deadline < now && step.status !== 'completed') {
          await this.handleOverdueStep(workflowId, step);
        }
      }
    }
  }

  private async handleOverdueStep(workflowId: string, step: WorkflowStep): Promise<void> {
    console.log(`Overdue step: ${step.name} in workflow ${workflowId}`);
    
    // This would send escalation notifications
    await this.notifyStepEscalated(workflowId, step, 'Step deadline exceeded');
  }

  private startNotificationSystem(): void {
    // This would integrate with your notification system
    console.log('Starting notification system...');
  }

  // Helper methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async getRole(roleId: string): Promise<Role | null> {
    // This would fetch from database
    return null;
  }
}
