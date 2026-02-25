import { MultiChainPaymentService } from '../../../src/services/MultiChainPaymentService';
import { BlockchainNetwork, CrossChainStatus, TransactionStatus } from '../../../src/blockchain/types';
import { BridgeProvider, CrossChainTransaction } from '../../../src/blockchain/types';

// Mock bridge provider
class MockBridgeProvider implements BridgeProvider {
  name = 'MockBridge';
  supportedNetworks: [BlockchainNetwork, BlockchainNetwork][] = [
    [BlockchainNetwork.ETHEREUM, BlockchainNetwork.POLYGON],
    [BlockchainNetwork.POLYGON, BlockchainNetwork.ETHEREUM]
  ];

  async estimateBridgeFee(request: any): Promise<string> {
    return '0.01';
  }

  async initiateBridge(request: any): Promise<CrossChainTransaction> {
    return {
      id: 'bridge-tx-id',
      fromNetwork: request.fromNetwork,
      toNetwork: request.toNetwork,
      fromAddress: request.fromAddress,
      toAddress: request.toAddress,
      amount: request.amount,
      asset: request.asset,
      status: CrossChainStatus.INITIATED,
      sourceTransactionHash: 'source-tx-hash',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getBridgeStatus(transactionId: string): Promise<CrossChainTransaction> {
    return {
      id: transactionId,
      fromNetwork: BlockchainNetwork.ETHEREUM,
      toNetwork: BlockchainNetwork.POLYGON,
      fromAddress: '0x123...',
      toAddress: '0x456...',
      amount: '1',
      asset: 'ETH',
      status: CrossChainStatus.COMPLETED,
      sourceTransactionHash: 'source-tx-hash',
      destinationTransactionHash: 'dest-tx-hash',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getSupportedAssets(fromNetwork: BlockchainNetwork, toNetwork: BlockchainNetwork): Promise<string[]> {
    return ['ETH', 'USDC', 'USDT'];
  }
}

describe('MultiChainPaymentService', () => {
  let paymentService: MultiChainPaymentService;
  let mockBridgeProvider: MockBridgeProvider;

  beforeEach(() => {
    paymentService = new MultiChainPaymentService({
      environment: 'testnet' as any,
      enableCrossChain: true,
      maxGasPrice: '100',
      gasMultiplier: 1.2
    });
    mockBridgeProvider = new MockBridgeProvider();
    paymentService.registerBridgeProvider('MockBridge', mockBridgeProvider);
  });

  describe('Payment Processing', () => {
    test('should process payment successfully', async () => {
      const request = {
        billId: 'bill-123',
        userId: 'user-123',
        amount: '0.1',
        currency: 'ETH',
        network: BlockchainNetwork.ETHEREUM,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        memo: 'Payment for electricity bill'
      };

      const result = await paymentService.processPayment(request);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('mock-tx-hash');
      expect(result.network).toBe(BlockchainNetwork.ETHEREUM);
      expect(result.amount).toBe('0.1');
      expect(result.currency).toBe('ETH');
      expect(result.status).toBe('confirmed');
    });

    test('should validate payment request', async () => {
      const invalidRequest = {
        billId: '',
        userId: 'user-123',
        amount: '0.1',
        currency: 'ETH',
        network: BlockchainNetwork.ETHEREUM,
        recipientAddress: '0x1234567890123456789012345678901234567890'
      };

      const result = await paymentService.processPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required payment fields');
    });

    test('should validate payment amount', async () => {
      const invalidRequest = {
        billId: 'bill-123',
        userId: 'user-123',
        amount: '-1',
        currency: 'ETH',
        network: BlockchainNetwork.ETHEREUM,
        recipientAddress: '0x1234567890123456789012345678901234567890'
      };

      const result = await paymentService.processPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Payment amount must be greater than 0');
    });

    test('should validate recipient address', async () => {
      const invalidRequest = {
        billId: 'bill-123',
        userId: 'user-123',
        amount: '0.1',
        currency: 'ETH',
        network: BlockchainNetwork.ETHEREUM,
        recipientAddress: 'invalid-address'
      };

      const result = await paymentService.processPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient address');
    });

    test('should skip gas estimation when requested', async () => {
      const request = {
        billId: 'bill-123',
        userId: 'user-123',
        amount: '0.1',
        currency: 'ETH',
        network: BlockchainNetwork.ETHEREUM,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        skipGasEstimation: true
      };

      const result = await paymentService.processPayment(request);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('mock-tx-hash');
    });
  });

  describe('Cross-Chain Payments', () => {
    test('should process cross-chain payment successfully', async () => {
      const request = {
        fromNetwork: BlockchainNetwork.ETHEREUM,
        toNetwork: BlockchainNetwork.POLYGON,
        fromAddress: '0x1234567890123456789012345678901234567890',
        toAddress: '0x0987654321098765432109876543210987654321',
        amount: '1',
        asset: 'ETH'
      };

      const result = await paymentService.processCrossChainPayment(request);

      expect(result.id).toBe('bridge-tx-id');
      expect(result.fromNetwork).toBe(BlockchainNetwork.ETHEREUM);
      expect(result.toNetwork).toBe(BlockchainNetwork.POLYGON);
      expect(result.status).toBe(CrossChainStatus.INITIATED);
      expect(result.sourceTransactionHash).toBe('source-tx-hash');
    });

    test('should fail when cross-chain is disabled', async () => {
      const disabledService = new MultiChainPaymentService({
        enableCrossChain: false
      });

      const request = {
        fromNetwork: BlockchainNetwork.ETHEREUM,
        toNetwork: BlockchainNetwork.POLYGON,
        fromAddress: '0x123...',
        toAddress: '0x456...',
        amount: '1',
        asset: 'ETH'
      };

      await expect(disabledService.processCrossChainPayment(request))
        .rejects.toThrow('Cross-chain payments are not enabled');
    });

    test('should fail when no bridge provider available', async () => {
      const request = {
        fromNetwork: BlockchainNetwork.STELLAR,
        toNetwork: BlockchainNetwork.ETHEREUM,
        fromAddress: 'G...',
        toAddress: '0x...',
        amount: '100',
        asset: 'XLM'
      };

      await expect(paymentService.processCrossChainPayment(request))
        .rejects.toThrow('No bridge provider available');
    });
  });

  describe('Balance and Network Operations', () => {
    test('should get balance for address', async () => {
      const balance = await paymentService.getBalance(
        '0x1234567890123456789012345678901234567890',
        BlockchainNetwork.ETHEREUM,
        'ETH'
      );

      expect(balance.address).toBe('0x1234567890123456789012345678901234567890');
      expect(balance.asset).toBe('ETH');
      expect(balance.formatted).toBe('1.0');
    });

    test('should get network fee info', async () => {
      const feeInfo = await paymentService.getNetworkFeeInfo(BlockchainNetwork.ETHEREUM);

      expect(feeInfo.slow.gasPrice).toBe('10');
      expect(feeInfo.standard.gasPrice).toBe('20');
      expect(feeInfo.fast.gasPrice).toBe('30');
      expect(feeInfo.currency).toBe('ETH');
    });

    test('should validate addresses', () => {
      const validETH = '0x1234567890123456789012345678901234567890';
      const validStellar = 'G1234567890123456789012345678901234567890';
      const invalid = 'invalid-address';

      expect(paymentService.validateAddress(validETH, BlockchainNetwork.ETHEREUM)).toBe(true);
      expect(paymentService.validateAddress(validStellar, BlockchainNetwork.STELLAR)).toBe(true);
      expect(paymentService.validateAddress(invalid, BlockchainNetwork.ETHEREUM)).toBe(false);
    });
  });

  describe('Bridge Provider Management', () => {
    test('should register bridge providers', () => {
      const providers = paymentService.getBridgeProviders(
        BlockchainNetwork.ETHEREUM,
        BlockchainNetwork.POLYGON
      );

      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('MockBridge');
    });

    test('should get available bridge providers for route', () => {
      const providers = paymentService.getBridgeProviders(
        BlockchainNetwork.ETHEREUM,
        BlockchainNetwork.POLYGON
      );

      expect(providers).toHaveLength(1);
      expect(providers[0].supportedNetworks).toContainEqual([
        BlockchainNetwork.ETHEREUM,
        BlockchainNetwork.POLYGON
      ]);
    });

    test('should return empty array for unsupported route', () => {
      const providers = paymentService.getBridgeProviders(
        BlockchainNetwork.STELLAR,
        BlockchainNetwork.ETHEREUM
      );

      expect(providers).toHaveLength(0);
    });
  });

  describe('Connection Status', () => {
    test('should get supported networks', () => {
      const networks = paymentService.getSupportedNetworks();

      expect(networks).toContain(BlockchainNetwork.STELLAR);
      expect(networks).toContain(BlockchainNetwork.ETHEREUM);
      expect(networks).toContain(BlockchainNetwork.POLYGON);
    });

    test('should get connection status', async () => {
      const status = await paymentService.getConnectionStatus();

      expect(status).toBeInstanceOf(Map);
      expect(status.size).toBeGreaterThan(0);
    });

    test('should perform health check', async () => {
      const health = await paymentService.healthCheck();

      expect(health).toBeInstanceOf(Map);
      expect(health.size).toBeGreaterThan(0);
    });
  });

  describe('Payment Status Tracking', () => {
    test('should get payment status across networks', async () => {
      const status = await paymentService.getPaymentStatus('mock-tx-hash');

      expect(status.hash).toBe('mock-tx-hash');
      expect(status.status).toBe(TransactionStatus.CONFIRMED);
    });

    test('should get payment status for specific network', async () => {
      const status = await paymentService.getPaymentStatus('mock-tx-hash', BlockchainNetwork.ETHEREUM);

      expect(status.hash).toBe('mock-tx-hash');
      expect(status.status).toBe(TransactionStatus.CONFIRMED);
    });
  });

  describe('Metrics and Configuration', () => {
    test('should get provider metrics', () => {
      const metrics = paymentService.getMetrics();

      expect(metrics).toHaveProperty(BlockchainNetwork.STELLAR);
      expect(metrics).toHaveProperty(BlockchainNetwork.ETHEREUM);
      expect(metrics).toHaveProperty(BlockchainNetwork.POLYGON);
    });
  });

  describe('Error Handling', () => {
    test('should handle payment processing errors gracefully', async () => {
      const invalidRequest = {
        billId: 'bill-123',
        userId: 'user-123',
        amount: '0.1',
        currency: 'ETH',
        network: BlockchainNetwork.ETHEREUM,
        recipientAddress: 'invalid-address'
      };

      const result = await paymentService.processPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.network).toBe(BlockchainNetwork.ETHEREUM);
      expect(result.amount).toBe('0.1');
      expect(result.currency).toBe('ETH');
    });

    test('should handle cross-chain payment errors', async () => {
      const request = {
        fromNetwork: BlockchainNetwork.STELLAR,
        toNetwork: BlockchainNetwork.ETHEREUM,
        fromAddress: 'G...',
        toAddress: '0x...',
        amount: '100',
        asset: 'XLM'
      };

      await expect(paymentService.processCrossChainPayment(request))
        .rejects.toThrow('No bridge provider available');
    });
  });
});
