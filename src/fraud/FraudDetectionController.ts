import { Request, Response } from 'express';
import { FraudDetectionService } from './FraudDetectionService';
import { FraudReviewService } from './FraudReviewService';
import { 
  FraudDetectionRequest, 
  FraudDetectionResponse,
  FraudDetectionStatus,
  FraudRiskLevel,
  FraudType
} from './types';

const fraudDetectionService = new FraudDetectionService();
// Note: In a real implementation, you'd inject Prisma client
const fraudReviewService = new FraudReviewService({} as any);

/**
 * Detect fraud in a transaction
 */
export const detectFraud = async (req: Request, res: Response) => {
  try {
    const { transactionId, features, userId, ipAddress, userAgent, deviceId } = req.body;

    // Validate request
    if (!transactionId || !features || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transactionId, features, userId'
      });
    }

    const request: FraudDetectionRequest = {
      transactionId,
      features,
      userId,
      ipAddress,
      userAgent,
      deviceId,
      timestamp: new Date()
    };

    const result: FraudDetectionResponse = await fraudDetectionService.detectFraud(request);

    // If fraud is detected, create a case for review
    if (result.result && result.result.requiresManualReview) {
      await fraudReviewService.createFraudCase(result.result, transactionId, userId);
    }

    // Block transaction if risk is critical
    if (result.result && result.result.shouldBlock) {
      return res.status(403).json({
        success: false,
        error: 'Transaction blocked due to high fraud risk',
        riskScore: result.result.riskScore,
        riskLevel: result.result.riskLevel,
        requiresManualReview: true
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Fraud detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during fraud detection'
    });
  }
};

/**
 * Get fraud detection statistics
 */
export const getFraudStats = async (req: Request, res: Response) => {
  try {
    const { timeRange } = req.query;
    
    const timeRangeObj = typeof timeRange === 'string' ? JSON.parse(timeRange) : timeRange || {};
    
    const stats = await fraudReviewService.getReviewStatistics({
      start: timeRangeObj.start ? new Date(timeRangeObj.start) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: timeRangeObj.end ? new Date(timeRangeObj.end) : new Date()
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting fraud stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fraud statistics'
    });
  }
};

/**
 * Get fraud cases for review
 */
export const getFraudCases = async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      riskLevel, 
      page = 1, 
      limit = 20,
      reviewerId 
    } = req.query;

    // In a real implementation, you'd query the database with filters
    const cases = await getFilteredFraudCases({
      status: status as string,
      riskLevel: riskLevel as string,
      reviewerId: reviewerId as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: {
        cases,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: cases.length // Would be actual count from database
        }
      }
    });

  } catch (error) {
    console.error('Error getting fraud cases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fraud cases'
    });
  }
};

/**
 * Get specific fraud case details
 */
export const getFraudCase = async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        error: 'Case ID is required'
      });
    }

    const fraudCase = await fraudReviewService.getFraudCase(caseId);

    if (!fraudCase) {
      return res.status(404).json({
        success: false,
        error: 'Fraud case not found'
      });
    }

    res.json({
      success: true,
      data: fraudCase
    });

  } catch (error) {
    console.error('Error getting fraud case:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fraud case'
    });
  }
};

/**
 * Update fraud case review
 */
export const updateFraudReview = async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { reviewerId, updates } = req.body;

    if (!caseId || !reviewerId || !updates) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: caseId, reviewerId, updates'
      });
    }

    const workflow = await fraudReviewService.updateReviewWorkflow(caseId, reviewerId, updates);

    res.json({
      success: true,
      data: workflow
    });

  } catch (error) {
    console.error('Error updating fraud review:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update fraud review'
    });
  }
};

/**
 * Complete fraud case review
 */
export const completeFraudReview = async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { reviewerId, decision, notes, attachments } = req.body;

    if (!caseId || !reviewerId || !decision) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: caseId, reviewerId, decision'
      });
    }

    const validDecisions = ['fraud', 'legitimate', 'investigating'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid decision. Must be: fraud, legitimate, or investigating'
      });
    }

    const fraudCase = await fraudReviewService.completeReview(
      caseId, 
      reviewerId, 
      decision, 
      notes || '', 
      attachments
    );

    res.json({
      success: true,
      data: fraudCase
    });

  } catch (error) {
    console.error('Error completing fraud review:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete fraud review'
    });
  }
};

/**
 * Escalate fraud case
 */
export const escalateFraudCase = async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const { reason, escalatedBy } = req.body;

    if (!caseId || !reason || !escalatedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: caseId, reason, escalatedBy'
      });
    }

    await fraudReviewService.escalateCase(caseId, reason, escalatedBy);

    res.json({
      success: true,
      message: 'Case escalated successfully'
    });

  } catch (error) {
    console.error('Error escalating fraud case:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to escalate fraud case'
    });
  }
};

/**
 * Get reviewer workload
 */
export const getReviewerWorkload = async (req: Request, res: Response) => {
  try {
    const { reviewerId } = req.params;

    if (!reviewerId) {
      return res.status(400).json({
        success: false,
        error: 'Reviewer ID is required'
      });
    }

    const workload = await fraudReviewService.getReviewerWorkload(reviewerId);

    res.json({
      success: true,
      data: workload
    });

  } catch (error) {
    console.error('Error getting reviewer workload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve reviewer workload'
    });
  }
};

/**
 * Train fraud detection model
 */
export const trainFraudModel = async (req: Request, res: Response) => {
  try {
    const { modelType, trainingData, validationSplit, hyperparameters, features } = req.body;

    if (!trainingData || !Array.isArray(trainingData)) {
      return res.status(400).json({
        success: false,
        error: 'Training data is required and must be an array'
      });
    }

    // Start training in background
    const trainingPromise = fraudDetectionService.trainModel(trainingData);

    // Don't wait for training to complete - return immediately
    res.json({
      success: true,
      message: 'Model training started',
      trainingId: generateTrainingId()
    });

    // Handle training completion asynchronously
    trainingPromise
      .then(() => {
        console.log('Model training completed successfully');
      })
      .catch((error) => {
        console.error('Model training failed:', error);
      });

  } catch (error) {
    console.error('Error starting model training:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start model training'
    });
  }
};

/**
 * Get fraud analytics
 */
export const getFraudAnalytics = async (req: Request, res: Response) => {
  try {
    const { timeRange, granularity } = req.query;
    
    const analytics = await generateFraudAnalytics({
      timeRange: timeRange as string,
      granularity: granularity as string
    });

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Error getting fraud analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fraud analytics'
    });
  }
};

/**
 * Get fraud alerts
 */
export const getFraudAlerts = async (req: Request, res: Response) => {
  try {
    const { severity, acknowledged, page = 1, limit = 20 } = req.query;

    const alerts = await getFilteredFraudAlerts({
      severity: severity as string,
      acknowledged: acknowledged === 'true',
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: alerts.length
        }
      }
    });

  } catch (error) {
    console.error('Error getting fraud alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve fraud alerts'
    });
  }
};

/**
 * Acknowledge fraud alert
 */
export const acknowledgeFraudAlert = async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;

    if (!alertId || !acknowledgedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: alertId, acknowledgedBy'
      });
    }

    await acknowledgeAlert(alertId, acknowledgedBy);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    console.error('Error acknowledging fraud alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge fraud alert'
    });
  }
};

// Helper functions (would be implemented with actual database queries)
async function getFilteredFraudCases(filters: any): Promise<any[]> {
  // Mock implementation - would query database with filters
  return [];
}

async function getFilteredFraudAlerts(filters: any): Promise<any[]> {
  // Mock implementation - would query database with filters
  return [];
}

async function generateFraudAnalytics(options: any): Promise<any> {
  // Mock implementation - would generate real analytics
  return {
    totalTransactions: 1000,
    fraudTransactions: 25,
    fraudRate: 2.5,
    blockedTransactions: 15,
    manualReviews: 30,
    confirmedFraud: 20,
    falsePositives: 5,
    averageRiskScore: 35.5,
    riskDistribution: {
      [FraudRiskLevel.LOW]: 800,
      [FraudRiskLevel.MEDIUM]: 150,
      [FraudRiskLevel.HIGH]: 40,
      [FraudRiskLevel.CRITICAL]: 10
    },
    fraudTypeDistribution: {
      [FraudType.UNUSUAL_PATTERN]: 10,
      [FraudType.VELOCITY_ATTACK]: 5,
      [FraudType.GEOGRAPHIC_ANOMALY]: 3,
      [FraudType.DEVICE_ANOMALY]: 4,
      [FraudType.ACCOUNT_TAKEOVER]: 2,
      [FraudType.CARD_TESTING]: 1
    }
  };
}

async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
  // Mock implementation - would update database
  console.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
}

function generateTrainingId(): string {
  return Math.random().toString(36).substr(2, 9);
}
