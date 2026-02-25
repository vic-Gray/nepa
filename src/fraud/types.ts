export enum FraudRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum FraudDetectionStatus {
  PENDING = 'pending',
  REVIEW_REQUIRED = 'review_required',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CONFIRMED_FRAUD = 'confirmed_fraud',
  FALSE_POSITIVE = 'false_positive'
}

export enum FraudType {
  ACCOUNT_TAKEOVER = 'account_takeover',
  SYNTHETIC_IDENTITY = 'synthetic_identity',
  CARD_TESTING = 'card_testing',
  VELOCITY_ATTACK = 'velocity_attack',
  COLLUSION = 'collusion',
  MONEY_LAUNDERING = 'money_laundering',
  UNUSUAL_PATTERN = 'unusual_pattern',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  DEVICE_ANOMALY = 'device_anomaly',
  BEHAVIORAL_ANOMALY = 'behavioral_anomaly',
  AMOUNT_ANOMALY = 'amount_anomaly',
  TIME_ANOMALY = 'time_anomaly'
}

export interface TransactionFeatures {
  // Basic transaction features
  amount: number;
  currency: string;
  network: string;
  timestamp: Date;
  userId: string;
  
  // User behavior features
  userTransactionCount24h: number;
  userTransactionCount7d: number;
  userTransactionCount30d: number;
  userAvgTransactionAmount: number;
  userTotalAmount24h: number;
  userTotalAmount7d: number;
  userTotalAmount30d: number;
  userAccountAge: number; // days since account creation
  userLastLoginTime: Date;
  userLoginFrequency: number; // logins per week
  
  // Geographic features
  ipAddress: string;
  country: string;
  city: string;
  isHighRiskCountry: boolean;
  isVPN: boolean;
  isTor: boolean;
  distanceFromLastLocation: number; // km
  locationChangeTime: number; // hours since last location change
  
  // Device features
  deviceId: string;
  deviceFingerprint: string;
  userAgent: string;
  isNewDevice: boolean;
  deviceAge: number; // days since first seen
  deviceTransactionCount: number;
  
  // Temporal features
  hourOfDay: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isBusinessHours: boolean;
  timeSinceLastTransaction: number; // minutes
  transactionVelocity: number; // transactions per hour
  
  // Network features
  blockchainNetwork: string;
  isCrossChain: boolean;
  gasPrice?: number;
  confirmations?: number;
  blockNumber?: number;
  
  // Pattern features
  isRecurringPayment: boolean;
  isUnusualAmount: boolean;
  isUnusualTime: boolean;
  isUnusualLocation: boolean;
  isUnusualDevice: boolean;
  amountDeviationFromAvg: number; // standard deviations
  frequencyDeviationFromAvg: number; // standard deviations
  
  // Risk indicators
  isBlacklistedAddress: boolean;
  isBlacklistedDevice: boolean;
  isBlacklistedIP: boolean;
  hasFailedTransactions: boolean;
  failedTransactionCount: number;
  chargebackHistory: number;
}

export interface FraudDetectionResult {
  transactionId: string;
  riskScore: number; // 0-100
  riskLevel: FraudRiskLevel;
  confidence: number; // 0-1
  detectedFraudTypes: FraudType[];
  reasons: string[];
  requiresManualReview: boolean;
  shouldBlock: boolean;
  modelVersion: string;
  processingTime: number; // milliseconds
  timestamp: Date;
}

export interface FraudModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  truePositiveRate: number;
  trueNegativeRate: number;
  rocAuc: number;
  confusionMatrix: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
  totalSamples: number;
  lastUpdated: Date;
}

export interface FraudModelConfig {
  modelType: 'neural_network' | 'random_forest' | 'gradient_boosting' | 'isolation_forest';
  version: string;
  threshold: number; // risk score threshold for blocking
  reviewThreshold: number; // risk score threshold for manual review
  features: string[];
  hyperparameters: Record<string, any>;
  trainingDataSize: number;
  validationDataSize: number;
  lastTrained: Date;
  performance: FraudModelMetrics;
}

export interface FraudCase {
  id: string;
  transactionId: string;
  userId: string;
  riskScore: number;
  riskLevel: FraudRiskLevel;
  detectedFraudTypes: FraudType[];
  status: FraudDetectionStatus;
  reviewerId?: string;
  reviewNotes?: string;
  actualOutcome?: 'fraud' | 'legitimate' | 'investigating';
  modelVersion: string;
  features: TransactionFeatures;
  detectionResult: FraudDetectionResult;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface FraudPattern {
  id: string;
  name: string;
  description: string;
  fraudType: FraudType;
  pattern: string; // JSON pattern definition
  isActive: boolean;
  severity: FraudRiskLevel;
  detectionRules: string[];
  falsePositiveRate: number;
  detectionRate: number;
  lastTriggered: Date;
  triggerCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FraudAlert {
  id: string;
  caseId: string;
  transactionId: string;
  userId: string;
  alertType: FraudType;
  severity: FraudRiskLevel;
  message: string;
  details: Record<string, any>;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export interface MLTrainingData {
  id: string;
  transactionId: string;
  features: TransactionFeatures;
  isFraud: boolean;
  fraudType?: FraudType;
  confidence: number;
  modelVersion: string;
  dataSource: 'manual_review' | 'chargeback' | 'user_report' | 'automated';
  createdAt: Date;
}

export interface FraudDetectionRequest {
  transactionId: string;
  features: TransactionFeatures;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  timestamp: Date;
}

export interface FraudDetectionResponse {
  success: boolean;
  result?: FraudDetectionResult;
  error?: string;
  processingTime: number;
}

export interface ModelTrainingRequest {
  modelType: 'neural_network' | 'random_forest' | 'gradient_boosting' | 'isolation_forest';
  trainingData: MLTrainingData[];
  validationSplit: number; // 0.0-1.0
  hyperparameters?: Record<string, any>;
  features?: string[];
}

export interface ModelTrainingResponse {
  success: boolean;
  modelId?: string;
  modelVersion?: string;
  metrics?: FraudModelMetrics;
  error?: string;
  trainingTime: number; // milliseconds
}

export interface FraudAnalytics {
  totalTransactions: number;
  fraudTransactions: number;
  fraudRate: number;
  blockedTransactions: number;
  manualReviews: number;
  confirmedFraud: number;
  falsePositives: number;
  averageRiskScore: number;
  riskDistribution: Record<FraudRiskLevel, number>;
  fraudTypeDistribution: Record<FraudType, number>;
  geographicDistribution: Record<string, number>;
  temporalDistribution: {
    hourly: Record<number, number>;
    daily: Record<number, number>;
    weekly: Record<number, number>;
  };
  modelPerformance: FraudModelMetrics;
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface AdaptiveLearningConfig {
  enabled: boolean;
  learningRate: number;
  batchSize: number;
  updateFrequency: number; // hours
  minSamplesForUpdate: number;
  maxModelAge: number; // days
  performanceThreshold: number; // minimum accuracy to keep model
  autoRetraining: boolean;
  featureImportanceThreshold: number;
}

export interface RealTimeMonitoringConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  batchSize: number;
  maxConcurrentChecks: number;
  alertThresholds: {
    riskScore: number;
    transactionVolume: number;
    failedAttempts: number;
    geographicAnomalies: number;
  };
  notificationChannels: ('email' | 'sms' | 'webhook' | 'slack')[];
}

export interface ManualReviewWorkflow {
  id: string;
  caseId: string;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'escalated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: Date;
  checklist: {
    verifyUserIdentity: boolean;
    checkTransactionHistory: boolean;
    validateGeographicData: boolean;
    reviewDeviceInformation: boolean;
    analyzeBehavioralPatterns: boolean;
    contactUserIfNecessary: boolean;
  };
  notes: string[];
  attachments: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
