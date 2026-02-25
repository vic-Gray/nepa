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
  TransactionStatus,
  NetworkEnvironment,
  BlockchainErrorImpl
} from '../types';
import { ethers, BrowserProvider, Signer, Contract, parseEther, formatEther } from 'ethers';

export interface EthereumConfig extends BlockchainConfig {
  infuraProjectId?: string;
  alchemyApiKey?: string;
  privateKey?: string;
  walletConnectProjectId?: string;
}

export class EthereumProvider implements BlockchainProvider {
  readonly network = BlockchainNetwork.ETHEREUM;
  readonly config: EthereumConfig;
  
  private provider: ethers.JsonRpcProvider | null = null;
  private browserProvider: BrowserProvider | null = null;
  private signer: Signer | null = null;
  private isConnected = false;

  constructor(config: EthereumConfig) {
    this.config = config;
    this.initializeProvider();
  }

  private initializeProvider(): void {
    try {
      // Initialize provider based on environment
      if (typeof window !== 'undefined' && window.ethereum) {
        // Browser environment with MetaMask or similar
        this.browserProvider = new BrowserProvider(window.ethereum);
        this.provider = this.browserProvider;
      } else {
        // Server environment or no wallet available
        let rpcUrl = this.config.rpcUrl;
        
        // Use Infura or Alchemy if available
        if (this.config.infuraProjectId && !rpcUrl.includes('infura')) {
          rpcUrl = `https://${this.config.environment}.infura.io/v3/${this.config.infuraProjectId}`;
        } else if (this.config.alchemyApiKey && !rpcUrl.includes('alchemy')) {
          rpcUrl = `https://${this.config.environment}.g.alchemy.com/v2/${this.config.alchemyApiKey}`;
        }
        
        this.provider = new ethers.JsonRpcProvider(rpcUrl, {
          chainId: this.config.chainId,
          name: this.getNetworkName()
        });
      }
    } catch (error) {
      console.error('Failed to initialize Ethereum provider:', error);
      throw new BlockchainErrorImpl(
        'Failed to initialize Ethereum provider',
        'PROVIDER_INIT_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  private getNetworkName(): string {
    switch (this.config.environment) {
      case NetworkEnvironment.MAINNET:
        return 'mainnet';
      case NetworkEnvironment.TESTNET:
        return 'sepolia';
      case NetworkEnvironment.DEVNET:
        return 'localhost';
      default:
        return 'unknown';
    }
  }

  async connect(): Promise<WalletConnection> {
    try {
      if (!this.browserProvider) {
        throw new BlockchainErrorImpl(
          'No browser wallet available. Please install MetaMask or another Web3 wallet.',
          'NO_WALLET',
          this.network
        );
      }

      // Request account access
      await this.browserProvider.send('eth_requestAccounts', []);
      this.signer = await this.browserProvider.getSigner();
      
      // Get network information
      const network = await this.browserProvider.getNetwork();
      const address = await this.signer.getAddress();
      
      this.isConnected = true;

      return {
        address,
        network: this.network,
        chainId: Number(network.chainId),
        isConnected: true
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to connect to Ethereum wallet',
        'CONNECTION_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async disconnect(): Promise<void> {
    this.signer = null;
    this.isConnected = false;
  }

  isConnected(): boolean {
    return this.isConnected && this.signer !== null;
  }

  async getAccount(): Promise<string | null> {
    if (!this.signer) {
      return null;
    }
    return await this.signer.getAddress();
  }

  async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
    if (!this.signer) {
      throw new BlockchainErrorImpl(
        'Wallet not connected',
        'NOT_CONNECTED',
        this.network
      );
    }

    try {
      // Convert amount to wei
      const value = parseEther(request.amount);
      
      // Prepare transaction
      const txRequest: ethers.TransactionRequest = {
        to: request.to,
        value,
        data: request.memo ? ethers.toUtf8Bytes(request.memo) : '0x'
      };

      // Add gas parameters if provided
      if (request.gasLimit) {
        txRequest.gasLimit = request.gasLimit;
      }
      if (request.gasPrice) {
        txRequest.gasPrice = parseEther(request.gasPrice);
      }
      if (request.maxFeePerGas) {
        txRequest.maxFeePerGas = parseEther(request.maxFeePerGas);
      }
      if (request.maxPriorityFeePerGas) {
        txRequest.maxPriorityFeePerGas = parseEther(request.maxPriorityFeePerGas);
      }

      // Send transaction
      const txResponse = await this.signer.sendTransaction(txRequest);
      
      // Wait for receipt
      const receipt = await txResponse.wait();
      
      return {
        hash: txResponse.hash,
        status: receipt?.status === 1 ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
        from: txResponse.from,
        to: txResponse.to || '',
        amount: formatEther(txResponse.value || 0),
        gasUsed: receipt?.gasUsed?.toString(),
        gasPrice: txResponse.gasPrice?.toString(),
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        timestamp: receipt ? new Date() : undefined,
        confirmations: receipt ? 1 : 0,
        fee: receipt ? formatEther(receipt.fee || 0) : undefined
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Transaction failed',
        'TRANSACTION_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async estimateGas(request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>): Promise<GasEstimate> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const value = parseEther(request.amount);
      
      const gasEstimate = await this.provider.estimateGas({
        to: request.to,
        value,
        data: request.memo ? ethers.toUtf8Bytes(request.memo) : '0x'
      });

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const maxFeePerGas = feeData.maxFeePerGas;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      // Calculate estimated cost
      const estimatedCost = gasEstimate * gasPrice;
      
      return {
        gasLimit: gasEstimate.toString(),
        gasPrice: formatEther(gasPrice),
        maxFeePerGas: maxFeePerGas ? formatEther(maxFeePerGas) : undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas ? formatEther(maxPriorityFeePerGas) : undefined,
        estimatedCost: formatEther(estimatedCost),
        formattedCost: `${formatEther(estimatedCost)} ETH`,
        currency: 'ETH'
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Gas estimation failed',
        'GAS_ESTIMATION_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async getTransactionStatus(hash: string): Promise<TransactionResponse> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(hash),
        this.provider.getTransactionReceipt(hash)
      ]);

      if (!tx) {
        throw new BlockchainErrorImpl(
          'Transaction not found',
          'TRANSACTION_NOT_FOUND',
          this.network,
          hash
        );
      }

      return {
        hash: tx.hash,
        status: receipt ? (receipt.status === 1 ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED) : TransactionStatus.PENDING,
        from: tx.from,
        to: tx.to || '',
        amount: formatEther(tx.value || 0),
        gasUsed: receipt?.gasUsed?.toString(),
        gasPrice: tx.gasPrice?.toString(),
        blockNumber: receipt?.blockNumber,
        blockHash: receipt?.blockHash,
        timestamp: receipt ? new Date() : undefined,
        confirmations: receipt ? receipt.confirmations || 0 : 0,
        fee: receipt ? formatEther(receipt.fee || 0) : undefined
      };
    } catch (error: any) {
      if (error instanceof BlockchainErrorImpl) {
        throw error;
      }
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get transaction status',
        'STATUS_CHECK_FAILED',
        this.network,
        hash,
        error
      );
    }
  }

  async waitForTransaction(hash: string, confirmations: number = 1): Promise<TransactionResponse> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const receipt = await this.provider.waitForTransaction(hash, confirmations);
      
      if (!receipt) {
        throw new BlockchainErrorImpl(
          'Transaction not found',
          'TRANSACTION_NOT_FOUND',
          this.network,
          hash
        );
      }

      const tx = await this.provider.getTransaction(hash);
      
      return {
        hash: receipt.hash,
        status: receipt.status === 1 ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
        from: tx?.from || '',
        to: tx?.to || '',
        amount: tx ? formatEther(tx.value || 0) : '0',
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: tx?.gasPrice?.toString(),
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        timestamp: new Date(),
        confirmations: receipt.confirmations || 0,
        fee: formatEther(receipt.fee || 0)
      };
    } catch (error: any) {
      if (error instanceof BlockchainErrorImpl) {
        throw error;
      }
      throw new BlockchainErrorImpl(
        error.message || 'Failed to wait for transaction',
        'WAIT_FAILED',
        this.network,
        hash,
        error
      );
    }
  }

  async getBalance(address: string, asset: string = 'ETH'): Promise<Balance> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const balance = await this.provider.getBalance(address);
      const formattedBalance = formatEther(balance);
      
      return {
        address,
        asset,
        amount: balance.toString(),
        decimals: 18,
        formatted: formattedBalance
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get balance',
        'BALANCE_CHECK_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async getMultipleBalances(address: string, assets: string[]): Promise<Balance[]> {
    const balances: Balance[] = [];
    
    for (const asset of assets) {
      try {
        const balance = await this.getBalance(address, asset);
        balances.push(balance);
      } catch (error) {
        console.error(`Failed to get balance for ${asset}:`, error);
      }
    }
    
    return balances;
  }

  async getNetworkFeeInfo(): Promise<NetworkFeeInfo> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const feeData = await this.provider.getFeeData();
      
      if (!feeData.gasPrice) {
        throw new BlockchainErrorImpl(
          'Gas price not available',
          'GAS_PRICE_UNAVAILABLE',
          this.network
        );
      }

      const baseGasPrice = Number(formatEther(feeData.gasPrice));
      
      return {
        slow: {
          gasPrice: (baseGasPrice * 0.9).toString(),
          estimatedTime: 5 // minutes
        },
        standard: {
          gasPrice: baseGasPrice.toString(),
          estimatedTime: 2
        },
        fast: {
          gasPrice: (baseGasPrice * 1.2).toString(),
          estimatedTime: 1
        },
        currency: 'ETH'
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get network fee info',
        'FEE_INFO_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      return blockNumber;
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get current block',
        'BLOCK_CHECK_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async getBlockTimestamp(blockNumber: number): Promise<Date> {
    if (!this.provider) {
      throw new BlockchainErrorImpl(
        'Provider not initialized',
        'NO_PROVIDER',
        this.network
      );
    }

    try {
      const block = await this.provider.getBlock(blockNumber);
      if (!block) {
        throw new BlockchainErrorImpl(
          'Block not found',
          'BLOCK_NOT_FOUND',
          this.network
        );
      }
      return new Date(block.timestamp * 1000);
    } catch (error: any) {
      if (error instanceof BlockchainErrorImpl) {
        throw error;
      }
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get block timestamp',
        'BLOCK_TIMESTAMP_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  validateAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  formatAmount(amount: string, decimals: number): string {
    try {
      return formatEther(ethers.parseUnits(amount, decimals));
    } catch {
      return '0';
    }
  }

  parseAmount(formattedAmount: string, decimals: number): string {
    try {
      return ethers.parseUnits(formattedAmount, decimals).toString();
    } catch {
      return '0';
    }
  }

  onTransactionUpdate(hash: string, callback: (tx: TransactionResponse) => void): void {
    // Implementation would depend on WebSocket provider setup
    // For now, this is a placeholder
    console.log(`Transaction update listener set for hash: ${hash}`);
  }

  onNetworkChange(callback: (network: BlockchainNetwork) => void): void {
    // Implementation would listen for network changes
    console.log('Network change listener set');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (!this.provider) {
        return {
          healthy: false,
          details: { error: 'Provider not initialized' }
        };
      }

      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();
      
      return {
        healthy: true,
        details: {
          blockNumber,
          chainId: Number(network.chainId),
          networkName: network.name,
          rpcUrl: this.config.rpcUrl
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  getMetrics(): any {
    return {
      network: this.network,
      isConnected: this.isConnected,
      hasSigner: this.signer !== null,
      config: {
        environment: this.config.environment,
        rpcUrl: this.config.rpcUrl,
        chainId: this.config.chainId
      }
    };
  }
}
