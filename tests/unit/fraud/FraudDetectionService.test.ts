import { FraudDetectionService } from '../../../src/fraud/FraudDetectionService';
import {
  FraudDetectionRequest,
  TransactionFeatures,
  FraudRiskLevel,
  FraudType,
  MLTrainingData
} from '../../../src/fraud/types';

describe('FraudDetectionService', () => {
  let fraudDetectionService: FraudDetectionService;

  beforeEach(() => {
    fraudDetectionService = new FraudDetectionService();
  });

  describe('detectFraud', () => {
    it('should detect low risk for legitimate transaction', async () => {
      const request: FraudDetectionRequest = {
        transactionId: 'tx-123',
        features: createLegitimateTransactionFeatures(),
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceId: 'device-123',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.riskScore).toBeLessThan(40);
      expect(result.result!.riskLevel).toBe(FraudRiskLevel.LOW);
      expect(result.result!.requiresManualReview).toBe(false);
      expect(result.result!.shouldBlock).toBe(false);
    });

    it('should detect high risk for suspicious transaction', async () => {
      const request: FraudDetectionRequest = {
        transactionId: 'tx-456',
        features: createSuspiciousTransactionFeatures(),
        userId: 'user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        deviceId: 'device-456',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.riskScore).toBeGreaterThan(60);
      expect(result.result!.riskLevel).toBe(FraudRiskLevel.HIGH);
      expect(result.result!.requiresManualReview).toBe(true);
    });

    it('should detect velocity attack', async () => {
      const features: TransactionFeatures = {
        ...createLegitimateTransactionFeatures(),
        transactionVelocity: 25, // High velocity
        userTransactionCount24h: 50
      };

      const request: FraudDetectionRequest = {
        transactionId: 'tx-velocity',
        features,
        userId: 'user-velocity',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-velocity',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result!.detectedFraudTypes).toContain(FraudType.VELOCITY_ATTACK);
    });

    it('should detect geographic anomaly', async () => {
      const features: TransactionFeatures = {
        ...createLegitimateTransactionFeatures(),
        distanceFromLastLocation: 2000, // 2000 km
        locationChangeTime: 2, // 2 hours
        isUnusualLocation: true
      };

      const request: FraudDetectionRequest = {
        transactionId: 'tx-geo',
        features,
        userId: 'user-geo',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-geo',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result!.detectedFraudTypes).toContain(FraudType.GEOGRAPHIC_ANOMALY);
    });

    it('should detect device anomaly', async () => {
      const features: TransactionFeatures = {
        ...createLegitimateTransactionFeatures(),
        isNewDevice: true,
        userAccountAge: 3, // 3 days old account
        deviceAge: 1
      };

      const request: FraudDetectionRequest = {
        transactionId: 'tx-device',
        features,
        userId: 'user-device',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-new',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result!.detectedFraudTypes).toContain(FraudType.DEVICE_ANOMALY);
    });

    it('should detect amount anomaly', async () => {
      const features: TransactionFeatures = {
        ...createLegitimateTransactionFeatures(),
        amount: 10000, // Very high amount
        userAvgTransactionAmount: 100,
        amountDeviationFromAvg: 5
      };

      const request: FraudDetectionRequest = {
        transactionId: 'tx-amount',
        features,
        userId: 'user-amount',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-amount',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result!.detectedFraudTypes).toContain(FraudType.AMOUNT_ANOMALY);
    });

    it('should detect account takeover', async () => {
      const features: TransactionFeatures = {
        ...createLegitimateTransactionFeatures(),
        isNewDevice: true,
        isUnusualLocation: true,
        timeSinceLastTransaction: 30, // 30 minutes
        userAccountAge: 30
      };

      const request: FraudDetectionRequest = {
        transactionId: 'tx-takeover',
        features,
        userId: 'user-takeover',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-takeover',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result!.detectedFraudTypes).toContain(FraudType.ACCOUNT_TAKEOVER);
    });

    it('should handle blacklisted entities', async () => {
      const features: TransactionFeatures = {
        ...createLegitimateTransactionFeatures(),
        isBlacklistedAddress: true
      };

      const request: FraudDetectionRequest = {
        transactionId: 'tx-blacklist',
        features,
        userId: 'user-blacklist',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceId: 'device-blacklist',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(request);

      expect(result.success).toBe(true);
      expect(result.result!.reasons).toContain('Transaction involves blacklisted address');
    });

    it('should handle service errors gracefully', async () => {
      const invalidRequest: FraudDetectionRequest = {
        transactionId: '',
        features: null as any,
        userId: '',
        ipAddress: '',
        userAgent: '',
        deviceId: '',
        timestamp: new Date()
      };

      const result = await fraudDetectionService.detectFraud(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('trainModel', () => {
    it('should train model with valid data', async () => {
      const trainingData: MLTrainingData[] = [
        {
          id: 'train-1',
          transactionId: 'tx-train-1',
          features: createLegitimateTransactionFeatures(),
          isFraud: false,
          confidence: 0.95,
          modelVersion: '1.0.0',
          dataSource: 'manual_review',
          createdAt: new Date()
        },
        {
          id: 'train-2',
          transactionId: 'tx-train-2',
          features: createSuspiciousTransactionFeatures(),
          isFraud: true,
          confidence: 0.88,
          modelVersion: '1.0.0',
          dataSource: 'chargeback',
          createdAt: new Date()
        }
      ];

      await expect(fraudDetectionService.trainModel(trainingData)).resolves.not.toThrow();
    });

    it('should handle empty training data', async () => {
      const trainingData: MLTrainingData[] = [];

      await expect(fraudDetectionService.trainModel(trainingData)).resolves.not.toThrow();
    });

    it('should prevent concurrent training', async () => {
      const trainingData: MLTrainingData[] = [
        {
          id: 'train-concurrent',
          transactionId: 'tx-concurrent',
          features: createLegitimateTransactionFeatures(),
          isFraud: false,
          confidence: 0.95,
          modelVersion: '1.0.0',
          dataSource: 'manual_review',
          createdAt: new Date()
        }
      ];

      // Start first training
      const firstTraining = fraudDetectionService.trainModel(trainingData);
      
      // Try to start second training immediately
      await expect(fraudDetectionService.trainModel(trainingData)).rejects.toThrow('Model is already training');
      
      // Wait for first training to complete
      await firstTraining;
    });
  });

  describe('adaptiveLearning', () => {
    it('should perform adaptive learning with sufficient data', async () => {
      // Simulate some training data accumulation
      for (let i = 0; i < 150; i++) {
        const request: FraudDetectionRequest = {
          transactionId: `tx-adaptive-${i}`,
          features: createLegitimateTransactionFeatures(),
          userId: `user-adaptive-${i}`,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          deviceId: `device-adaptive-${i}`,
          timestamp: new Date()
        };

        await fraudDetectionService.detectFraud(request);
      }

      await expect(fraudDetectionService.adaptiveLearning()).resolves.not.toThrow();
    });

    it('should skip adaptive learning with insufficient data', async () => {
      await expect(fraudDetectionService.adaptiveLearning()).resolves.not.toThrow();
    });
  });

  // Helper functions
  function createLegitimateTransactionFeatures(): TransactionFeatures {
    return {
      amount: 100,
      currency: 'USD',
      network: 'stellar',
      timestamp: new Date(),
      userId: 'user-legit',
      userTransactionCount24h: 2,
      userTransactionCount7d: 10,
      userTransactionCount30d: 40,
      userAvgTransactionAmount: 120,
      userTotalAmount24h: 200,
      userTotalAmount7d: 1000,
      userTotalAmount30d: 4000,
      userAccountAge: 365,
      userLastLoginTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      userLoginFrequency: 5,
      ipAddress: '192.168.1.1',
      country: 'US',
      city: 'New York',
      isHighRiskCountry: false,
      isVPN: false,
      isTor: false,
      distanceFromLastLocation: 10,
      locationChangeTime: 24,
      deviceId: 'device-legit',
      deviceFingerprint: 'fp-legit',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isNewDevice: false,
      deviceAge: 180,
      deviceTransactionCount: 20,
      hourOfDay: 14,
      dayOfWeek: 3,
      isWeekend: false,
      isBusinessHours: true,
      timeSinceLastTransaction: 120,
      transactionVelocity: 2,
      blockchainNetwork: 'stellar',
      isCrossChain: false,
      gasPrice: undefined,
      confirmations: undefined,
      blockNumber: undefined,
      isRecurringPayment: false,
      isUnusualAmount: false,
      isUnusualTime: false,
      isUnusualLocation: false,
      isUnusualDevice: false,
      amountDeviationFromAvg: 0.5,
      frequencyDeviationFromAvg: 0.2,
      isBlacklistedAddress: false,
      isBlacklistedDevice: false,
      isBlacklistedIP: false,
      hasFailedTransactions: false,
      failedTransactionCount: 0,
      chargebackHistory: 0
    };
  }

  function createSuspiciousTransactionFeatures(): TransactionFeatures {
    return {
      amount: 5000,
      currency: 'USD',
      network: 'ethereum',
      timestamp: new Date(),
      userId: 'user-suspicious',
      userTransactionCount24h: 15,
      userTransactionCount7d: 80,
      userTransactionCount30d: 200,
      userAvgTransactionAmount: 150,
      userTotalAmount24h: 75000,
      userTotalAmount7d: 12000,
      userTotalAmount30d: 30000,
      userAccountAge: 5,
      userLastLoginTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      userLoginFrequency: 1,
      ipAddress: '192.168.1.1',
      country: 'US',
      city: 'Los Angeles',
      isHighRiskCountry: true,
      isVPN: true,
      isTor: false,
      distanceFromLastLocation: 1500,
      locationChangeTime: 1,
      deviceId: 'device-suspicious',
      deviceFingerprint: 'fp-suspicious',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isNewDevice: true,
      deviceAge: 1,
      deviceTransactionCount: 2,
      hourOfDay: 2,
      dayOfWeek: 6,
      isWeekend: true,
      isBusinessHours: false,
      timeSinceLastTransaction: 5,
      transactionVelocity: 15,
      blockchainNetwork: 'ethereum',
      isCrossChain: true,
      gasPrice: 100,
      confirmations: 1,
      blockNumber: 12345678,
      isRecurringPayment: false,
      isUnusualAmount: true,
      isUnusualTime: true,
      isUnusualLocation: true,
      isUnusualDevice: true,
      amountDeviationFromAvg: 4,
      frequencyDeviationFromAvg: 3,
      isBlacklistedAddress: false,
      isBlacklistedDevice: false,
      isBlacklistedIP: false,
      hasFailedTransactions: true,
      failedTransactionCount: 3,
      chargebackHistory: 1
    };
  }
});
