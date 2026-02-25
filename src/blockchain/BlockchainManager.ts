import { 
  BlockchainProvider, 
  BlockchainNetwork, 
  TransactionRequest, 
  TransactionResponse, 
  WalletConnection,
  Balance,
  GasEstimate,
  NetworkFeeInfo,
  BlockchainConfig,
  BlockchainError,
  BlockchainErrorImpl
} from './types';

export class BlockchainManager {
  private providers: Map<BlockchainNetwork, BlockchainProvider> = new Map();
  private currentProvider: BlockchainProvider | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Register a blockchain provider
   */
  registerProvider(provider: BlockchainProvider): void {
    this.providers.set(provider.network, provider);
    
    // Set up provider event listeners
    if (provider.onTransactionUpdate) {
      provider.onTransactionUpdate('default', (tx: TransactionResponse) => {
        this.emit('transactionUpdate', { hash: tx.hash, transaction: tx, network: provider.network });
      });
    }
    
    if (provider.onNetworkChange) {
      provider.onNetworkChange((network: BlockchainNetwork) => {
        this.emit('networkChange', { network });
      });
    }
  }

  /**
   * Get a provider for a specific network
   */
  getProvider(network: BlockchainNetwork): BlockchainProvider | null {
    return this.providers.get(network) || null;
  }

  /**
   * Set the current active provider
   */
  setCurrentProvider(network: BlockchainNetwork): boolean {
    const provider = this.providers.get(network);
    if (provider) {
      this.currentProvider = provider;
      this.emit('providerChanged', { network, provider });
      return true;
    }
    return false;
  }

  /**
   * Get the current active provider
   */
  getCurrentProvider(): BlockchainProvider | null {
    return this.currentProvider;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<BlockchainNetwork, BlockchainProvider> {
    return new Map(this.providers);
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks(): BlockchainNetwork[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Connect to a specific network
   */
  async connect(network: BlockchainNetwork): Promise<WalletConnection> {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new BlockchainErrorImpl(`Provider not found for network: ${network}`, 'PROVIDER_NOT_FOUND', network);
    }

    try {
      const connection = await provider.connect();
      this.currentProvider = provider;
      this.emit('connected', { network, connection });
      return connection;
    } catch (error) {
      const blockchainError = this.createBlockchainError(error, network);
      this.emit('connectionError', { network, error: blockchainError });
      throw blockchainError;
    }
  }

  /**
   * Disconnect from current network
   */
  async disconnect(): Promise<void> {
    if (!this.currentProvider) {
      return;
    }

    try {
      await this.currentProvider.disconnect();
      const network = this.currentProvider.network;
      this.currentProvider = null;
      this.emit('disconnected', { network });
    } catch (error) {
      const network = this.currentProvider.network;
      const blockchainError = this.createBlockchainError(error, network);
      this.emit('disconnectionError', { network, error: blockchainError });
      throw blockchainError;
    }
  }

  /**
   * Check if connected to any network
   */
  isConnected(): boolean {
    return this.currentProvider?.isConnected() || false;
  }

  /**
   * Get current account address
   */
  async getAccount(): Promise<string | null> {
    if (!this.currentProvider) {
      return null;
    }
    return await this.currentProvider.getAccount();
  }

  /**
   * Send a transaction on the current network
   */
  async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
    if (!this.currentProvider) {
      throw new BlockchainErrorImpl('No provider connected', 'NO_PROVIDER', this.getCurrentNetwork() || BlockchainNetwork.STELLAR);
    }

    try {
      this.emit('transactionSending', { request, network: this.currentProvider.network });
      const response = await this.currentProvider.sendTransaction(request);
      this.emit('transactionSent', { request, response, network: this.currentProvider.network });
      return response;
    } catch (error) {
      const blockchainError = this.createBlockchainError(error, this.currentProvider.network);
      this.emit('transactionError', { request, error: blockchainError, network: this.currentProvider.network });
      throw blockchainError;
    }
  }

  /**
   * Send a transaction on a specific network
   */
  async sendTransactionOnNetwork(network: BlockchainNetwork, request: TransactionRequest): Promise<TransactionResponse> {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new BlockchainErrorImpl(`Provider not found for network: ${network}`, 'PROVIDER_NOT_FOUND', network);
    }

    try {
      this.emit('transactionSending', { request, network });
      const response = await provider.sendTransaction(request);
      this.emit('transactionSent', { request, response, network });
      return response;
    } catch (error) {
      const blockchainError = this.createBlockchainError(error, network);
      this.emit('transactionError', { request, error: blockchainError, network });
      throw blockchainError;
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>): Promise<GasEstimate> {
    if (!this.currentProvider) {
      throw new BlockchainErrorImpl('No provider connected', 'NO_PROVIDER', this.getCurrentNetwork() || BlockchainNetwork.STELLAR);
    }

    try {
      return await this.currentProvider.estimateGas(request);
    } catch (error) {
      throw this.createBlockchainError(error, this.currentProvider.network);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(hash: string, network?: BlockchainNetwork): Promise<TransactionResponse> {
    const provider = network ? this.providers.get(network) : this.currentProvider;
    if (!provider) {
      throw new BlockchainErrorImpl('No provider available', 'NO_PROVIDER', network || this.getCurrentNetwork() || BlockchainNetwork.STELLAR);
    }

    try {
      return await provider.getTransactionStatus(hash);
    } catch (error) {
      throw this.createBlockchainError(error, provider.network);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: string, confirmations?: number, network?: BlockchainNetwork): Promise<TransactionResponse> {
    const provider = network ? this.providers.get(network) : this.currentProvider;
    if (!provider) {
      throw new BlockchainErrorImpl('No provider available', 'NO_PROVIDER', network || this.getCurrentNetwork() || BlockchainNetwork.STELLAR);
    }

    try {
      return await provider.waitForTransaction(hash, confirmations);
    } catch (error) {
      throw this.createBlockchainError(error, provider.network);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address: string, asset?: string, network?: BlockchainNetwork): Promise<Balance> {
    const provider = network ? this.providers.get(network) : this.currentProvider;
    if (!provider) {
      throw new BlockchainErrorImpl('No provider available', 'NO_PROVIDER', network || this.getCurrentNetwork() || BlockchainNetwork.STELLAR);
    }

    try {
      return await provider.getBalance(address, asset);
    } catch (error) {
      throw this.createBlockchainError(error, provider.network);
    }
  }

  /**
   * Get network fee information
   */
  async getNetworkFeeInfo(network?: BlockchainNetwork): Promise<NetworkFeeInfo> {
    const provider = network ? this.providers.get(network) : this.currentProvider;
    if (!provider) {
      throw new BlockchainErrorImpl('No provider available', 'NO_PROVIDER', network || this.getCurrentNetwork() || BlockchainNetwork.STELLAR);
    }

    try {
      return await provider.getNetworkFeeInfo();
    } catch (error) {
      throw this.createBlockchainError(error, provider.network);
    }
  }

  /**
   * Validate address for a network
   */
  validateAddress(address: string, network?: BlockchainNetwork): boolean {
    const provider = network ? this.providers.get(network) : this.currentProvider;
    if (!provider) {
      return false;
    }
    return provider.validateAddress(address);
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): BlockchainNetwork | null {
    return this.currentProvider?.network || null;
  }

  /**
   * Switch to a different network
   */
  async switchNetwork(network: BlockchainNetwork): Promise<WalletConnection> {
    if (this.currentProvider?.network === network) {
      // Already on this network, just return current connection
      const account = await this.currentProvider.getAccount();
      if (!account) {
        throw new BlockchainErrorImpl('No account connected', 'NO_ACCOUNT', network);
      }
      return {
        address: account,
        network,
        isConnected: true
      };
    }

    return await this.connect(network);
  }

  /**
   * Event handling methods
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  private setupEventListeners(): void {
    // Set up default event listeners
    this.on('transactionUpdate', (data) => {
      console.log('Transaction update:', data);
    });

    this.on('networkChange', (data) => {
      console.log('Network changed:', data);
    });
  }

  private createBlockchainError(error: any, network: BlockchainNetwork): BlockchainErrorImpl {
    if (error instanceof BlockchainErrorImpl) {
      return error;
    }

    const blockchainError = new BlockchainErrorImpl(
      error.message || 'Unknown blockchain error',
      error.code || 'UNKNOWN_ERROR',
      network
    );

    if (error.transactionHash) {
      blockchainError.transactionHash = error.transactionHash;
    }

    if (error.details) {
      blockchainError.details = error.details;
    }

    return blockchainError;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(network: BlockchainNetwork): BlockchainConfig | null {
    const provider = this.providers.get(network);
    return provider?.config || null;
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(network: BlockchainNetwork, config: Partial<BlockchainConfig>): boolean {
    const provider = this.providers.get(network);
    if (provider && 'updateConfig' in provider) {
      (provider as any).updateConfig(config);
      this.emit('configUpdated', { network, config });
      return true;
    }
    return false;
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(network: BlockchainNetwork): any {
    const provider = this.providers.get(network);
    if (provider && 'getMetrics' in provider) {
      return (provider as any).getMetrics();
    }
    return null;
  }

  /**
   * Perform health check on all providers
   */
  async healthCheck(): Promise<Map<BlockchainNetwork, boolean>> {
    const results = new Map<BlockchainNetwork, boolean>();
    
    for (const [network, provider] of Array.from(this.providers.entries())) {
      try {
        if ('healthCheck' in provider) {
          const health = await (provider as any).healthCheck();
          results.set(network, health.healthy || false);
        } else {
          // Basic health check - try to get current block
          await provider.getCurrentBlock();
          results.set(network, true);
        }
      } catch (error) {
        results.set(network, false);
      }
    }

    return results;
  }
}
