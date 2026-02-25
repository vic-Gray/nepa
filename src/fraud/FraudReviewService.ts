import {
  FraudCase,
  FraudDetectionStatus,
  FraudRiskLevel,
  ManualReviewWorkflow,
  FraudAlert,
  FraudType
} from './types';
import { EventEmitter } from 'events';

// Mock PrismaClient for now - would be imported from @prisma/client
interface MockPrismaClient {
  // This would be replaced with actual PrismaClient
}

export class FraudReviewService extends EventEmitter {
  private prisma: MockPrismaClient;
  private activeReviews: Map<string, ManualReviewWorkflow> = new Map();
  private reviewQueue: FraudCase[] = [];
  private isProcessingQueue: boolean = false;

  constructor(prisma: MockPrismaClient) {
    super();
    this.prisma = prisma;
    this.startQueueProcessor();
  }

  /**
   * Create a new fraud case for manual review
   */
  async createFraudCase(detectionResult: any, transactionId: string, userId: string): Promise<FraudCase> {
    const fraudCase: FraudCase = {
      id: this.generateId(),
      transactionId,
      userId,
      riskScore: detectionResult.riskScore,
      riskLevel: detectionResult.riskLevel,
      detectedFraudTypes: detectionResult.detectedFraudTypes,
      status: detectionResult.requiresManualReview ? 
        FraudDetectionStatus.REVIEW_REQUIRED : 
        FraudDetectionStatus.PENDING,
      modelVersion: detectionResult.modelVersion,
      features: detectionResult.features,
      detectionResult,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to database
    await this.saveFraudCase(fraudCase);

    // Add to review queue if manual review is required
    if (detectionResult.requiresManualReview) {
      this.addToReviewQueue(fraudCase);
    }

    // Create alert for high-risk cases
    if (detectionResult.riskLevel === FraudRiskLevel.CRITICAL || 
        detectionResult.riskLevel === FraudRiskLevel.HIGH) {
      await this.createFraudAlert(fraudCase);
    }

    this.emit('fraudCaseCreated', fraudCase);
    return fraudCase;
  }

  /**
   * Add case to review queue
   */
  private addToReviewQueue(fraudCase: FraudCase): void {
    this.reviewQueue.push(fraudCase);
    this.reviewQueue.sort((a, b) => {
      // Sort by risk level (highest first)
      const riskOrder = {
        [FraudRiskLevel.CRITICAL]: 0,
        [FraudRiskLevel.HIGH]: 1,
        [FraudRiskLevel.MEDIUM]: 2,
        [FraudRiskLevel.LOW]: 3
      };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });

    this.emit('addedToQueue', fraudCase);
  }

  /**
   * Process review queue
   */
  private async startQueueProcessor(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessingQueue || this.reviewQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;
      
      try {
        const caseToReview = this.reviewQueue.shift();
        if (caseToReview) {
          await this.assignCaseToReviewer(caseToReview);
        }
      } catch (error) {
        console.error('Error processing review queue:', error);
      } finally {
        this.isProcessingQueue = false;
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Assign case to a reviewer
   */
  private async assignCaseToReviewer(fraudCase: FraudCase): Promise<void> {
    // Find available reviewer (simplified - in practice, you'd have a proper assignment system)
    const availableReviewers = await this.getAvailableReviewers();
    
    if (availableReviewers.length === 0) {
      // Re-add to queue if no reviewers available
      this.addToReviewQueue(fraudCase);
      return;
    }

    const assignedReviewer = availableReviewers[0]; // Simple assignment - first available
    
    const workflow: ManualReviewWorkflow = {
      id: this.generateId(),
      caseId: fraudCase.id,
      assignedTo: assignedReviewer.id,
      status: 'pending',
      priority: this.getPriorityFromRiskLevel(fraudCase.riskLevel),
      dueDate: this.calculateDueDate(fraudCase.riskLevel),
      checklist: {
        verifyUserIdentity: false,
        checkTransactionHistory: false,
        validateGeographicData: false,
        reviewDeviceInformation: false,
        analyzeBehavioralPatterns: false,
        contactUserIfNecessary: false
      },
      notes: [],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.activeReviews.set(fraudCase.id, workflow);
    await this.saveReviewWorkflow(workflow);

    // Notify reviewer
    await this.notifyReviewer(assignedReviewer.id, fraudCase, workflow);
    
    this.emit('caseAssigned', { fraudCase, workflow, reviewer: assignedReviewer });
  }

  /**
   * Get available reviewers
   */
  private async getAvailableReviewers(): Promise<any[]> {
    // This would query your user database for fraud reviewers
    // For now, return mock data
    return [
      { id: 'reviewer-1', name: 'John Doe', email: 'john@example.com' },
      { id: 'reviewer-2', name: 'Jane Smith', email: 'jane@example.com' }
    ];
  }

  /**
   * Get priority from risk level
   */
  private getPriorityFromRiskLevel(riskLevel: FraudRiskLevel): 'low' | 'medium' | 'high' | 'critical' {
    switch (riskLevel) {
      case FraudRiskLevel.CRITICAL: return 'critical';
      case FraudRiskLevel.HIGH: return 'high';
      case FraudRiskLevel.MEDIUM: return 'medium';
      case FraudRiskLevel.LOW: return 'low';
      default: return 'medium';
    }
  }

  /**
   * Calculate due date based on risk level
   */
  private calculateDueDate(riskLevel: FraudRiskLevel): Date {
    const now = new Date();
    const hours = {
      [FraudRiskLevel.CRITICAL]: 1,
      [FraudRiskLevel.HIGH]: 4,
      [FraudRiskLevel.MEDIUM]: 24,
      [FraudRiskLevel.LOW]: 72
    };
    
    return new Date(now.getTime() + (hours[riskLevel] || 24) * 60 * 60 * 1000);
  }

  /**
   * Update review workflow
   */
  async updateReviewWorkflow(
    caseId: string, 
    reviewerId: string, 
    updates: Partial<ManualReviewWorkflow>
  ): Promise<ManualReviewWorkflow> {
    const workflow = this.activeReviews.get(caseId);
    if (!workflow) {
      throw new Error('Review workflow not found');
    }

    if (workflow.assignedTo !== reviewerId) {
      throw new Error('Not authorized to update this review');
    }

    const updatedWorkflow = {
      ...workflow,
      ...updates,
      updatedAt: new Date()
    };

    this.activeReviews.set(caseId, updatedWorkflow);
    await this.saveReviewWorkflow(updatedWorkflow);

    this.emit('workflowUpdated', updatedWorkflow);
    return updatedWorkflow;
  }

  /**
   * Complete review with decision
   */
  async completeReview(
    caseId: string,
    reviewerId: string,
    decision: 'fraud' | 'legitimate' | 'investigating',
    notes: string,
    attachments?: string[]
  ): Promise<FraudCase> {
    const workflow = this.activeReviews.get(caseId);
    if (!workflow) {
      throw new Error('Review workflow not found');
    }

    // Update workflow
    workflow.status = 'completed';
    workflow.completedAt = new Date();
    workflow.notes.push(notes);
    if (attachments) {
      workflow.attachments.push(...attachments);
    }
    workflow.updatedAt = new Date();

    // Update fraud case
    const fraudCase = await this.getFraudCase(caseId);
    fraudCase.status = this.getStatusFromDecision(decision);
    fraudCase.actualOutcome = decision;
    fraudCase.reviewerId = reviewerId;
    fraudCase.reviewNotes = notes;
    fraudCase.resolvedAt = new Date();
    fraudCase.updatedAt = new Date();

    // Save both to database
    await Promise.all([
      this.saveReviewWorkflow(workflow),
      this.saveFraudCase(fraudCase)
    ]);

    // Remove from active reviews
    this.activeReviews.delete(caseId);

    // Trigger adaptive learning if this is confirmed fraud
    if (decision === 'fraud') {
      await this.triggerAdaptiveLearning(fraudCase);
    }

    this.emit('reviewCompleted', { fraudCase, workflow, decision });
    return fraudCase;
  }

  /**
   * Get status from decision
   */
  private getStatusFromDecision(decision: string): FraudDetectionStatus {
    switch (decision) {
      case 'fraud': return FraudDetectionStatus.CONFIRMED_FRAUD;
      case 'legitimate': return FraudDetectionStatus.FALSE_POSITIVE;
      case 'investigating': return FraudDetectionStatus.REVIEW_REQUIRED;
      default: return FraudDetectionStatus.PENDING;
    }
  }

  /**
   * Escalate case to higher authority
   */
  async escalateCase(caseId: string, reason: string, escalatedBy: string): Promise<void> {
    const workflow = this.activeReviews.get(caseId);
    if (!workflow) {
      throw new Error('Review workflow not found');
    }

    workflow.status = 'escalated';
    workflow.notes.push(`Escalated by ${escalatedBy}: ${reason}`);
    workflow.updatedAt = new Date();

    await this.saveReviewWorkflow(workflow);

    // Notify escalation team
    await this.notifyEscalationTeam(caseId, reason);

    this.emit('caseEscalated', { caseId, reason, escalatedBy });
  }

  /**
   * Get review statistics
   */
  async getReviewStatistics(timeRange: { start: Date, end: Date }): Promise<any> {
    const cases = await this.getFraudCasesInTimeRange(timeRange);
    
    const stats = {
      totalCases: cases.length,
      byStatus: {},
      byRiskLevel: {},
      byReviewer: {},
      averageResolutionTime: 0,
      overdueCases: 0,
      completionRate: 0
    };

    let totalResolutionTime = 0;
    let resolvedCases = 0;

    cases.forEach(c => {
      // Count by status
      stats.byStatus[c.status] = (stats.byStatus[c.status] || 0) + 1;
      
      // Count by risk level
      stats.byRiskLevel[c.riskLevel] = (stats.byRiskLevel[c.riskLevel] || 0) + 1;
      
      // Count by reviewer
      if (c.reviewerId) {
        stats.byReviewer[c.reviewerId] = (stats.byReviewer[c.reviewerId] || 0) + 1;
      }
      
      // Calculate resolution time
      if (c.resolvedAt) {
        const resolutionTime = c.resolvedAt.getTime() - c.createdAt.getTime();
        totalResolutionTime += resolutionTime;
        resolvedCases++;
      }
      
      // Count overdue cases
      const workflow = this.activeReviews.get(c.id);
      if (workflow && workflow.dueDate && workflow.dueDate < new Date() && workflow.status !== 'completed') {
        stats.overdueCases++;
      }
    });

    stats.averageResolutionTime = resolvedCases > 0 ? totalResolutionTime / resolvedCases : 0;
    stats.completionRate = cases.length > 0 ? (resolvedCases / cases.length) * 100 : 0;

    return stats;
  }

  /**
   * Get reviewer workload
   */
  async getReviewerWorkload(reviewerId: string): Promise<any> {
    const activeReviews = Array.from(this.activeReviews.values())
      .filter(w => w.assignedTo === reviewerId);

    const completedReviews = await this.getCompletedReviewsByReviewer(reviewerId);

    return {
      activeCases: activeReviews.length,
      activeCasesByPriority: {
        critical: activeReviews.filter(w => w.priority === 'critical').length,
        high: activeReviews.filter(w => w.priority === 'high').length,
        medium: activeReviews.filter(w => w.priority === 'medium').length,
        low: activeReviews.filter(w => w.priority === 'low').length
      },
      completedToday: completedReviews.filter(r => 
        new Date(r.completedAt).toDateString() === new Date().toDateString()
      ).length,
      completedThisWeek: completedReviews.filter(r => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return new Date(r.completedAt) > weekAgo;
      }).length,
      averageResolutionTime: this.calculateAverageResolutionTime(completedReviews)
    };
  }

  /**
   * Create fraud alert
   */
  private async createFraudAlert(fraudCase: FraudCase): Promise<FraudAlert> {
    const alert: FraudAlert = {
      id: this.generateId(),
      caseId: fraudCase.id,
      transactionId: fraudCase.transactionId,
      userId: fraudCase.userId,
      alertType: fraudCase.detectedFraudTypes[0] || FraudType.UNUSUAL_PATTERN,
      severity: fraudCase.riskLevel,
      message: `High-risk transaction detected: ${fraudCase.riskLevel} risk score`,
      details: {
        riskScore: fraudCase.riskScore,
        detectedFraudTypes: fraudCase.detectedFraudTypes,
        reasons: fraudCase.detectionResult.reasons
      },
      isAcknowledged: false,
      createdAt: new Date()
    };

    await this.saveFraudAlert(alert);
    this.emit('fraudAlert', alert);
    return alert;
  }

  /**
   * Trigger adaptive learning
   */
  private async triggerAdaptiveLearning(fraudCase: FraudCase): Promise<void> {
    // This would integrate with the FraudDetectionService
    // For now, just emit an event
    this.emit('triggerAdaptiveLearning', fraudCase);
  }

  // Database operations (simplified - would use actual Prisma models)
  private async saveFraudCase(fraudCase: FraudCase): Promise<void> {
    // Implementation would save to FraudCase table
    console.log('Saving fraud case:', fraudCase.id);
  }

  private async saveReviewWorkflow(workflow: ManualReviewWorkflow): Promise<void> {
    // Implementation would save to ManualReviewWorkflow table
    console.log('Saving review workflow:', workflow.id);
  }

  private async saveFraudAlert(alert: FraudAlert): Promise<void> {
    // Implementation would save to FraudAlert table
    console.log('Saving fraud alert:', alert.id);
  }

  public async getFraudCase(caseId: string): Promise<FraudCase> {
    // Implementation would fetch from database
    // Return mock data for now
    return {
      id: caseId,
      transactionId: 'tx-123',
      userId: 'user-123',
      riskScore: 85,
      riskLevel: FraudRiskLevel.HIGH,
      detectedFraudTypes: [FraudType.UNUSUAL_PATTERN],
      status: FraudDetectionStatus.REVIEW_REQUIRED,
      modelVersion: '1.0.0',
      features: {} as any,
      detectionResult: {} as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getFraudCasesInTimeRange(timeRange: { start: Date, end: Date }): Promise<FraudCase[]> {
    // Implementation would query database
    return [];
  }

  private async getCompletedReviewsByReviewer(reviewerId: string): Promise<any[]> {
    // Implementation would query database
    return [];
  }

  private calculateAverageResolutionTime(completedReviews: any[]): number {
    if (completedReviews.length === 0) return 0;
    
    const totalTime = completedReviews.reduce((sum, review) => {
      return sum + (review.completedAt.getTime() - review.createdAt.getTime());
    }, 0);
    
    return totalTime / completedReviews.length;
  }

  private async notifyReviewer(reviewerId: string, fraudCase: FraudCase, workflow: ManualReviewWorkflow): Promise<void> {
    // Implementation would send email/notification
    console.log(`Notifying reviewer ${reviewerId} about case ${fraudCase.id}`);
  }

  private async notifyEscalationTeam(caseId: string, reason: string): Promise<void> {
    // Implementation would notify escalation team
    console.log(`Escalating case ${caseId}: ${reason}`);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
