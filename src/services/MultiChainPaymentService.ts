import { 
  BlockchainManager, 
  BlockchainNetwork, 
  TransactionRequest, 
  TransactionResponse, 
  WalletConnection,
  Balance,
  GasEstimate,
  NetworkFeeInfo,
  CrossChainTransaction,
  CrossChainStatus,
  BridgeProvider,
  CrossChainRequest,
  BlockchainErrorImpl,
  createBlockchainManager,
  getDefaultConfigs,
  NetworkEnvironment
} from '../blockchain';

export interface PaymentRequest {
  billId: string;
  userId: string;
  amount: string;
  currency: string;
  network: BlockchainNetwork;
  recipientAddress: string;
  memo?: string;
  skipGasEstimation?: boolean;
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  network: BlockchainNetwork;
  amount: string;
  currency: string;
  status: string;
  error?: string;
  gasUsed?: string;
  gasPrice?: string;
  fee?: string;
  estimatedCompletion?: Date;
}

export interface MultiChainPaymentOptions {
  environment?: NetworkEnvironment;
  enableCrossChain?: boolean;
  preferredNetwork?: BlockchainNetwork;
  maxGasPrice?: string;
  gasMultiplier?: number;
}

export class MultiChainPaymentService {
  private blockchainManager: BlockchainManager;
  private bridgeProviders: Map<string, BridgeProvider> = new Map();
  private options: MultiChainPaymentOptions;

  constructor(options: MultiChainPaymentOptions = {}) {
    this.options = {
      environment: NetworkEnvironment.TESTNET,
      enableCrossChain: false,
      gasMultiplier: 1.1,
      ...options
    };

    const configs = getDefaultConfigs(this.options.environment);
    this.blockchainManager = createBlockchainManager(configs);
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.blockchainManager.on('transactionUpdate', ({ hash, transaction, network }) => {
      console.log(`Transaction update on ${network}:`, { hash, status: transaction.status });
    });

    this.blockchainManager.on('connectionError', ({ network, error }) => {
      console.error(`Connection error on ${network}:`, error);
    });
  }

  /**
   * Process a payment on the specified blockchain network
   */
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Validate request
      this.validatePaymentRequest(request);

      // Ensure we're connected to the correct network
      await this.ensureNetworkConnection(request.network);

      // Get gas estimation if not skipped
      let gasEstimate: GasEstimate | null = null;
      if (!request.skipGasEstimation) {
        gasEstimate = await this.blockchainManager.estimateGas({
          from: await this.getConnectedAddress(),
          to: request.recipientAddress,
          amount: request.amount,
          memo: request.memo
        });

        // Check if gas price is too high
        if (this.options.maxGasPrice && gasEstimate.gasPrice) {
          const maxGasPrice = parseFloat(this.options.maxGasPrice);
          const currentGasPrice = parseFloat(gasEstimate.gasPrice);
          
          if (currentGasPrice > maxGasPrice) {
            throw new BlockchainErrorImpl(
              `Gas price too high: ${currentGasPrice} > ${maxGasPrice}`,
              'GAS_PRICE_TOO_HIGH',
              request.network
            );
          }
        }
      }

      // Build transaction request
      const txRequest: TransactionRequest = {
        from: await this.getConnectedAddress(),
        to: request.recipientAddress,
        amount: request.amount,
        memo: request.memo,
        gasLimit: gasEstimate?.gasLimit,
        gasPrice: gasEstimate?.gasPrice
      };

      // Apply gas multiplier if configured
      if (this.options.gasMultiplier && gasEstimate?.gasPrice) {
        const adjustedGasPrice = (parseFloat(gasEstimate.gasPrice) * this.options.gasMultiplier).toString();
        txRequest.gasPrice = adjustedGasPrice;
      }

      // Send transaction
      const transaction = await this.blockchainManager.sendTransaction(txRequest);

      // Wait for confirmation
      const confirmedTransaction = await this.blockchainManager.waitForTransaction(transaction.hash, 1);

      return {
        success: confirmedTransaction.status === 'confirmed',
        transactionHash: confirmedTransaction.hash,
        network: request.network,
        amount: request.amount,
        currency: request.currency,
        status: confirmedTransaction.status,
        gasUsed: confirmedTransaction.gasUsed,
        gasPrice: confirmedTransaction.gasPrice,
        fee: confirmedTransaction.fee,
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      };
    } catch (error) {
      const blockchainError = error instanceof BlockchainErrorImpl ? error : new BlockchainErrorImpl(
        error.message || 'Payment processing failed',
        'PAYMENT_FAILED',
        request.network,
        undefined,
        error
      );

      return {
        success: false,
        network: request.network,
        amount: request.amount,
        currency: request.currency,
        status: 'failed',
        error: blockchainError.message
      };
    }
  }

  /**
   * Process a cross-chain payment
   */
  async processCrossChainPayment(request: CrossChainRequest): Promise<CrossChainTransaction> {
    if (!this.options.enableCrossChain) {
      throw new BlockchainErrorImpl(
        'Cross-chain payments are not enabled',
        'CROSS_CHAIN_DISABLED',
        request.fromNetwork
      );
    }

    // Find suitable bridge provider
    const bridgeProvider = this.findBridgeProvider(request.fromNetwork, request.toNetwork);
    if (!bridgeProvider) {
      throw new BlockchainErrorImpl(
        `No bridge provider available for ${request.fromNetwork} -> ${request.toNetwork}`,
        'NO_BRIDGE_PROVIDER',
        request.fromNetwork
      );
    }

    try {
      // Estimate bridge fee
      const bridgeFee = await bridgeProvider.estimateBridgeFee(request);
      
      // Initiate bridge transaction
      const crossChainTx = await bridgeProvider.initiateBridge(request);
      
      return crossChainTx;
    } catch (error) {
      throw new BlockchainErrorImpl(
        error.message || 'Cross-chain payment failed',
        'CROSS_CHAIN_FAILED',
        request.fromNetwork,
        undefined,
        error
      );
    }
  }

  /**
   * Get payment status across all networks
   */
  async getPaymentStatus(transactionHash: string, network?: BlockchainNetwork): Promise<TransactionResponse> {
    if (network) {
      return await this.blockchainManager.getTransactionStatus(transactionHash, network);
    }

    // Try all supported networks
    const supportedNetworks = this.blockchainManager.getSupportedNetworks();
    const errors: string[] = [];

    for (const supportedNetwork of supportedNetworks) {
      try {
        const status = await this.blockchainManager.getTransactionStatus(transactionHash, supportedNetwork);
        return status;
      } catch (error) {
        errors.push(`${supportedNetwork}: ${error.message}`);
      }
    }

    throw new BlockchainErrorImpl(
      `Transaction not found on any network. Errors: ${errors.join(', ')}`,
      'TRANSACTION_NOT_FOUND',
      BlockchainNetwork.STELLAR
    );
  }

  /**
   * Get balance for a specific address and network
   */
  async getBalance(address: string, network: BlockchainNetwork, asset?: string): Promise<Balance> {
    await this.ensureNetworkConnection(network);
    return await this.blockchainManager.getBalance(address, asset, network);
  }

  /**
   * Get network fee information
   */
  async getNetworkFeeInfo(network: BlockchainNetwork): Promise<NetworkFeeInfo> {
    await this.ensureNetworkConnection(network);
    return await this.blockchainManager.getNetworkFeeInfo(network);
  }

  /**
   * Validate address for a specific network
   */
  validateAddress(address: string, network: BlockchainNetwork): boolean {
    return this.blockchainManager.validateAddress(address, network);
  }

  /**
   * Get supported networks
   */
  getSupportedNetworks(): BlockchainNetwork[] {
    return this.blockchainManager.getSupportedNetworks();
  }

  /**
   * Get current connection status
   */
  async getConnectionStatus(): Promise<Map<BlockchainNetwork, boolean>> {
    const status = new Map<BlockchainNetwork, boolean>();
    const supportedNetworks = this.getSupportedNetworks();

    for (const network of supportedNetworks) {
      try {
        const provider = this.blockchainManager.getProvider(network);
        status.set(network, provider?.isConnected() || false);
      } catch {
        status.set(network, false);
      }
    }

    return status;
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Map<BlockchainNetwork, boolean>> {
    return await this.blockchainManager.healthCheck();
  }

  /**
   * Register a bridge provider for cross-chain transactions
   */
  registerBridgeProvider(name: string, provider: BridgeProvider): void {
    this.bridgeProviders.set(name, provider);
  }

  /**
   * Get available bridge providers for a route
   */
  getBridgeProviders(fromNetwork: BlockchainNetwork, toNetwork: BlockchainNetwork): BridgeProvider[] {
    const providers: BridgeProvider[] = [];
    
    for (const provider of this.bridgeProviders.values()) {
      if (provider.supportedNetworks.some(([from, to]) => 
        from === fromNetwork && to === toNetwork
      )) {
        providers.push(provider);
      }
    }
    
    return providers;
  }

  /**
   * Get metrics for all providers
   */
  getMetrics(): Record<BlockchainNetwork, any> {
    const metrics: Record<BlockchainNetwork, any> = {} as any;
    const supportedNetworks = this.getSupportedNetworks();

    for (const network of supportedNetworks) {
      metrics[network] = this.blockchainManager.getProviderMetrics(network);
    }

    return metrics;
  }

  // Private helper methods

  private validatePaymentRequest(request: PaymentRequest): void {
    if (!request.billId || !request.userId || !request.amount || !request.recipientAddress) {
      throw new BlockchainErrorImpl(
        'Missing required payment fields',
        'INVALID_REQUEST',
        request.network
      );
    }

    if (parseFloat(request.amount) <= 0) {
      throw new BlockchainErrorImpl(
        'Payment amount must be greater than 0',
        'INVALID_AMOUNT',
        request.network
      );
    }

    if (!this.validateAddress(request.recipientAddress, request.network)) {
      throw new BlockchainErrorImpl(
        'Invalid recipient address',
        'INVALID_ADDRESS',
        request.network
      );
    }
  }

  private async ensureNetworkConnection(network: BlockchainNetwork): Promise<void> {
    const currentNetwork = this.blockchainManager.getCurrentNetwork();
    
    if (currentNetwork !== network) {
      await this.blockchainManager.switchNetwork(network);
    }

    if (!this.blockchainManager.isConnected()) {
      await this.blockchainManager.connect(network);
    }
  }

  private async getConnectedAddress(): Promise<string> {
    const address = await this.blockchainManager.getAccount();
    
    if (!address) {
      throw new BlockchainErrorImpl(
        'No connected account',
        'NO_ACCOUNT',
        this.blockchainManager.getCurrentNetwork() || BlockchainNetwork.STELLAR
      );
    }
    
    return address;
  }

  private findBridgeProvider(fromNetwork: BlockchainNetwork, toNetwork: BlockchainNetwork): BridgeProvider | null {
    for (const provider of this.bridgeProviders.values()) {
      if (provider.supportedNetworks.some(([from, to]) => 
        from === fromNetwork && to === toNetwork
      )) {
        return provider;
      }
    }
    return null;
  }
}
