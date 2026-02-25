import { BlockchainManager } from '../../../src/blockchain/BlockchainManager';
import { BlockchainProvider, BlockchainNetwork, TransactionRequest, TransactionResponse, TransactionStatus, WalletConnection } from '../../../src/blockchain/types';
import { BlockchainErrorImpl } from '../../../src/blockchain/types';

// Mock provider for testing
class MockProvider implements BlockchainProvider {
  readonly network: BlockchainNetwork;
  readonly config: any;
  private connected: boolean = false;
  private account: string | null = null;

  constructor(network: BlockchainNetwork) {
    this.network = network;
    this.config = { network, rpcUrl: 'mock-url' };
  }

  async connect(): Promise<WalletConnection> {
    this.connected = true;
    this.account = 'mock-address';
    return {
      address: this.account,
      network: this.network,
      isConnected: true
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.account = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getAccount(): Promise<string | null> {
    return this.account;
  }

  async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
    return {
      hash: 'mock-tx-hash',
      status: TransactionStatus.CONFIRMED,
      from: request.from,
      to: request.to,
      amount: request.amount,
      timestamp: new Date(),
      confirmations: 1
    };
  }

  async estimateGas(request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>): Promise<any> {
    return {
      gasLimit: '21000',
      gasPrice: '20',
      estimatedCost: '0.00042',
      formattedCost: '0.00042 ETH',
      currency: 'ETH'
    };
  }

  async getTransactionStatus(hash: string): Promise<TransactionResponse> {
    return {
      hash,
      status: TransactionStatus.CONFIRMED,
      from: 'mock-from',
      to: 'mock-to',
      amount: '1',
      timestamp: new Date(),
      confirmations: 10
    };
  }

  async waitForTransaction(hash: string, confirmations?: number): Promise<TransactionResponse> {
    return this.getTransactionStatus(hash);
  }

  async getBalance(address: string, asset?: string): Promise<any> {
    return {
      address,
      asset: asset || 'ETH',
      amount: '1000000000000000000',
      decimals: 18,
      formatted: '1.0'
    };
  }

  async getMultipleBalances(address: string, assets: string[]): Promise<any[]> {
    return assets.map(asset => this.getBalance(address, asset));
  }

  async getNetworkFeeInfo(): Promise<any> {
    return {
      slow: { gasPrice: '10', estimatedTime: 5 },
      standard: { gasPrice: '20', estimatedTime: 2 },
      fast: { gasPrice: '30', estimatedTime: 1 },
      currency: 'ETH'
    };
  }

  async getCurrentBlock(): Promise<number> {
    return 12345;
  }

  async getBlockTimestamp(blockNumber: number): Promise<Date> {
    return new Date();
  }

  validateAddress(address: string): boolean {
    return address.startsWith('0x') && address.length === 42;
  }

  formatAmount(amount: string, decimals: number): string {
    return (parseFloat(amount) / Math.pow(10, decimals)).toString();
  }

  parseAmount(formattedAmount: string, decimals: number): string {
    return (parseFloat(formattedAmount) * Math.pow(10, decimals)).toString();
  }
}

describe('BlockchainManager', () => {
  let manager: BlockchainManager;
  let mockStellarProvider: MockProvider;
  let mockEthereumProvider: MockProvider;
  let mockPolygonProvider: MockProvider;

  beforeEach(() => {
    manager = new BlockchainManager();
    mockStellarProvider = new MockProvider(BlockchainNetwork.STELLAR);
    mockEthereumProvider = new MockProvider(BlockchainNetwork.ETHEREUM);
    mockPolygonProvider = new MockProvider(BlockchainNetwork.POLYGON);
  });

  describe('Provider Registration', () => {
    test('should register providers successfully', () => {
      manager.registerProvider(mockStellarProvider);
      manager.registerProvider(mockEthereumProvider);
      manager.registerProvider(mockPolygonProvider);

      expect(manager.getProvider(BlockchainNetwork.STELLAR)).toBe(mockStellarProvider);
      expect(manager.getProvider(BlockchainNetwork.ETHEREUM)).toBe(mockEthereumProvider);
      expect(manager.getProvider(BlockchainNetwork.POLYGON)).toBe(mockPolygonProvider);
    });

    test('should return null for unregistered networks', () => {
      expect(manager.getProvider(BlockchainNetwork.STELLAR)).toBeNull();
    });

    test('should get supported networks', () => {
      manager.registerProvider(mockStellarProvider);
      manager.registerProvider(mockEthereumProvider);

      const supportedNetworks = manager.getSupportedNetworks();
      expect(supportedNetworks).toContain(BlockchainNetwork.STELLAR);
      expect(supportedNetworks).toContain(BlockchainNetwork.ETHEREUM);
      expect(supportedNetworks).not.toContain(BlockchainNetwork.POLYGON);
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      manager.registerProvider(mockStellarProvider);
      manager.registerProvider(mockEthereumProvider);
    });

    test('should connect to Stellar network', async () => {
      const connection = await manager.connect(BlockchainNetwork.STELLAR);

      expect(connection.address).toBe('mock-address');
      expect(connection.network).toBe(BlockchainNetwork.STELLAR);
      expect(connection.isConnected).toBe(true);
      expect(manager.isConnected()).toBe(true);
      expect(manager.getCurrentNetwork()).toBe(BlockchainNetwork.STELLAR);
    });

    test('should throw error for unregistered network', async () => {
      await expect(manager.connect(BlockchainNetwork.POLYGON)).rejects.toThrow();
    });

    test('should disconnect successfully', async () => {
      await manager.connect(BlockchainNetwork.STELLAR);
      expect(manager.isConnected()).toBe(true);

      await manager.disconnect();
      expect(manager.isConnected()).toBe(false);
      expect(manager.getCurrentNetwork()).toBeNull();
    });

    test('should get current account', async () => {
      await manager.connect(BlockchainNetwork.STELLAR);
      const account = await manager.getAccount();
      expect(account).toBe('mock-address');
    });

    test('should return null when not connected', async () => {
      const account = await manager.getAccount();
      expect(account).toBeNull();
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      manager.registerProvider(mockStellarProvider);
      manager.registerProvider(mockEthereumProvider);
      await manager.connect(BlockchainNetwork.STELLAR);
    });

    test('should send transaction on current network', async () => {
      const request: TransactionRequest = {
        from: 'mock-address',
        to: 'recipient-address',
        amount: '1'
      };

      const response = await manager.sendTransaction(request);

      expect(response.hash).toBe('mock-tx-hash');
      expect(response.status).toBe(TransactionStatus.CONFIRMED);
      expect(response.from).toBe(request.from);
      expect(response.to).toBe(request.to);
      expect(response.amount).toBe(request.amount);
    });

    test('should send transaction on specific network', async () => {
      const request: TransactionRequest = {
        from: 'mock-address',
        to: 'recipient-address',
        amount: '1'
      };

      const response = await manager.sendTransactionOnNetwork(BlockchainNetwork.ETHEREUM, request);

      expect(response.hash).toBe('mock-tx-hash');
      expect(response.status).toBe(TransactionStatus.CONFIRMED);
    });

    test('should estimate gas', async () => {
      const request = {
        from: 'mock-address',
        to: 'recipient-address',
        amount: '1'
      };

      const estimate = await manager.estimateGas(request);

      expect(estimate.gasLimit).toBe('21000');
      expect(estimate.gasPrice).toBe('20');
      expect(estimate.estimatedCost).toBe('0.00042');
    });

    test('should get transaction status', async () => {
      const status = await manager.getTransactionStatus('mock-tx-hash');

      expect(status.hash).toBe('mock-tx-hash');
      expect(status.status).toBe(TransactionStatus.CONFIRMED);
      expect(status.confirmations).toBe(10);
    });

    test('should wait for transaction', async () => {
      const response = await manager.waitForTransaction('mock-tx-hash', 5);

      expect(response.hash).toBe('mock-tx-hash');
      expect(response.status).toBe(TransactionStatus.CONFIRMED);
    });
  });

  describe('Balance and Network Info', () => {
    beforeEach(async () => {
      manager.registerProvider(mockStellarProvider);
      await manager.connect(BlockchainNetwork.STELLAR);
    });

    test('should get balance', async () => {
      const balance = await manager.getBalance('mock-address', 'XLM');

      expect(balance.address).toBe('mock-address');
      expect(balance.asset).toBe('XLM');
      expect(balance.formatted).toBe('1.0');
    });

    test('should get network fee info', async () => {
      const feeInfo = await manager.getNetworkFeeInfo();

      expect(feeInfo.slow.gasPrice).toBe('10');
      expect(feeInfo.standard.gasPrice).toBe('20');
      expect(feeInfo.fast.gasPrice).toBe('30');
      expect(feeInfo.currency).toBe('ETH');
    });

    test('should validate address', () => {
      const validAddress = '0x1234567890123456789012345678901234567890';
      const invalidAddress = 'invalid-address';

      expect(manager.validateAddress(validAddress)).toBe(true);
      expect(manager.validateAddress(invalidAddress)).toBe(false);
    });

    test('should get current block', async () => {
      const blockNumber = await manager.getCurrentBlock();
      expect(blockNumber).toBe(12345);
    });
  });

  describe('Network Switching', () => {
    beforeEach(() => {
      manager.registerProvider(mockStellarProvider);
      manager.registerProvider(mockEthereumProvider);
    });

    test('should switch networks', async () => {
      await manager.connect(BlockchainNetwork.STELLAR);
      expect(manager.getCurrentNetwork()).toBe(BlockchainNetwork.STELLAR);

      const connection = await manager.switchNetwork(BlockchainNetwork.ETHEREUM);

      expect(connection.network).toBe(BlockchainNetwork.ETHEREUM);
      expect(manager.getCurrentNetwork()).toBe(BlockchainNetwork.ETHEREUM);
    });

    test('should return same connection if already on network', async () => {
      await manager.connect(BlockchainNetwork.STELLAR);
      const connection = await manager.switchNetwork(BlockchainNetwork.STELLAR);

      expect(connection.network).toBe(BlockchainNetwork.STELLAR);
      expect(manager.getCurrentNetwork()).toBe(BlockchainNetwork.STELLAR);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      manager.registerProvider(mockStellarProvider);
    });

    test('should emit connection events', async () => {
      const connectListener = jest.fn();
      const transactionListener = jest.fn();

      manager.on('connected', connectListener);
      manager.on('transactionSent', transactionListener);

      await manager.connect(BlockchainNetwork.STELLAR);

      expect(connectListener).toHaveBeenCalledWith({
        network: BlockchainNetwork.STELLAR,
        connection: expect.objectContaining({
          address: 'mock-address',
          network: BlockchainNetwork.STELLAR
        })
      });
    });

    test('should remove event listeners', () => {
      const listener = jest.fn();
      manager.on('connected', listener);
      manager.off('connected', listener);

      expect(manager['eventListeners'].get('connected')).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors', async () => {
      manager.registerProvider(mockStellarProvider);
      
      // Mock provider to throw error
      jest.spyOn(mockStellarProvider, 'connect').mockRejectedValue(new Error('Connection failed'));

      await expect(manager.connect(BlockchainNetwork.STELLAR)).rejects.toThrow('Connection failed');
    });

    test('should handle transaction errors', async () => {
      manager.registerProvider(mockStellarProvider);
      await manager.connect(BlockchainNetwork.STELLAR);

      // Mock provider to throw error
      jest.spyOn(mockStellarProvider, 'sendTransaction').mockRejectedValue(new Error('Transaction failed'));

      const request: TransactionRequest = {
        from: 'mock-address',
        to: 'recipient-address',
        amount: '1'
      };

      await expect(manager.sendTransaction(request)).rejects.toThrow('Transaction failed');
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      manager.registerProvider(mockStellarProvider);
      manager.registerProvider(mockEthereumProvider);
    });

    test('should perform health check on all providers', async () => {
      const healthResults = await manager.healthCheck();

      expect(healthResults.get(BlockchainNetwork.STELLAR)).toBe(true);
      expect(healthResults.get(BlockchainNetwork.ETHEREUM)).toBe(true);
      expect(healthResults.size).toBe(2);
    });
  });

  describe('Configuration', () => {
    beforeEach(() => {
      manager.registerProvider(mockStellarProvider);
    });

    test('should get provider configuration', () => {
      const config = manager.getProviderConfig(BlockchainNetwork.STELLAR);
      expect(config).toEqual(mockStellarProvider.config);
    });

    test('should return null for non-existent provider config', () => {
      const config = manager.getProviderConfig(BlockchainNetwork.ETHEREUM);
      expect(config).toBeNull();
    });
  });
});
