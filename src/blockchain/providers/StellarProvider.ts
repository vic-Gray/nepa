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
import { Horizon, Server, TransactionBuilder, Networks, Operation, Asset, Keypair } from '@stellar/stellar-sdk';

export interface StellarConfig extends BlockchainConfig {
  passphrase: string;
}

export class StellarProvider implements BlockchainProvider {
  readonly network = BlockchainNetwork.STELLAR;
  readonly config: StellarConfig;
  
  private server: Server;
  private keypair: Keypair | null = null;
  private _isConnected = false;

  constructor(config: StellarConfig) {
    this.config = config;
    this.server = new Server(config.rpcUrl);
  }

  async connect(): Promise<WalletConnection> {
    try {
      // For Stellar, we'll use a keypair approach for demo purposes
      // In production, this would integrate with wallets like Freighter
      if (!this.config.privateKey) {
        throw new BlockchainErrorImpl(
          'Stellar private key required for connection',
          'NO_PRIVATE_KEY',
          this.network
        );
      }

      this.keypair = Keypair.fromSecret(this.config.privateKey);
      this._isConnected = true;

      // Load account to verify it exists
      await this.server.loadAccount(this.keypair.publicKey());

      return {
        address: this.keypair.publicKey(),
        network: this.network,
        isConnected: true
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to connect to Stellar',
        'CONNECTION_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async disconnect(): Promise<void> {
    this.keypair = null;
    this._isConnected = false;
  }

  isConnected(): boolean {
    return this._isConnected && this.keypair !== null;
  }

  async getAccount(): Promise<string | null> {
    return this.keypair ? this.keypair.publicKey() : null;
  }

  async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
    if (!this.keypair) {
      throw new BlockchainErrorImpl(
        'Wallet not connected',
        'NOT_CONNECTED',
        this.network
      );
    }

    try {
      // Load source account
      const sourceAccount = await this.server.loadAccount(this.keypair.publicKey());
      
      // Create asset (default to XLM if not specified)
      const asset = request.asset === 'XLM' ? Asset.native() : new Asset(request.asset || 'XLM', request.to);
      
      // Build transaction
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: '100', // 0.00001 XLM
        networkPassphrase: this.config.passphrase
      })
        .addOperation(Operation.payment({
          destination: request.to,
          asset: asset,
          amount: request.amount
        }))
        .addMemo(request.memo ? Operation.memoText(request.memo) : Operation.memoNone())
        .setTimeout(30)
        .build();

      // Sign transaction
      transaction.sign(this.keypair);
      
      // Submit transaction
      const result = await this.server.submitTransaction(transaction);
      
      return {
        hash: result.hash,
        status: result.success ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
        from: this.keypair.publicKey(),
        to: request.to,
        amount: request.amount,
        asset: request.asset || 'XLM',
        timestamp: new Date(),
        confirmations: result.success ? 1 : 0,
        fee: '0.00001' // 100 stroops in XLM
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Stellar transaction failed',
        'TRANSACTION_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async estimateGas(request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>): Promise<GasEstimate> {
    // Stellar doesn't have gas like Ethereum, but has transaction fees
    return {
      gasLimit: '1',
      gasPrice: '0.00001',
      estimatedCost: '0.00001',
      formattedCost: '0.00001 XLM',
      currency: 'XLM'
    };
  }

  async getTransactionStatus(hash: string): Promise<TransactionResponse> {
    try {
      const transaction = await this.server.transactions().transaction(hash).call();
      
      return {
        hash: transaction.hash,
        status: transaction.successful ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
        from: transaction.source_account,
        to: this.extractDestination(transaction),
        amount: this.extractAmount(transaction),
        asset: this.extractAsset(transaction),
        timestamp: new Date(transaction.created_at),
        confirmations: transaction.successful ? 1 : 0,
        fee: transaction.fee_paid
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get Stellar transaction status',
        'STATUS_CHECK_FAILED',
        this.network,
        hash,
        error
      );
    }
  }

  async waitForTransaction(hash: string, confirmations: number = 1): Promise<TransactionResponse> {
    // Stellar transactions are typically final once confirmed
    return await this.getTransactionStatus(hash);
  }

  async getBalance(address: string, asset: string = 'XLM'): Promise<Balance> {
    try {
      const account = await this.server.loadAccount(address);
      const balance = account.balances.find(b => 
        asset === 'XLM' ? b.asset_type === 'native' : b.asset_code === asset
      );

      if (!balance) {
        throw new BlockchainErrorImpl(
          'Balance not found for asset',
          'BALANCE_NOT_FOUND',
          this.network
        );
      }

      return {
        address,
        asset,
        amount: balance.balance,
        decimals: 7, // Stellar uses 7 decimal places
        formatted: balance.balance
      };
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get Stellar balance',
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
    // Stellar has fixed minimum fees
    return {
      slow: {
        gasPrice: '0.00001',
        estimatedTime: 5 // seconds
      },
      standard: {
        gasPrice: '0.00001',
        estimatedTime: 3
      },
      fast: {
        gasPrice: '0.00002',
        estimatedTime: 1
      },
      currency: 'XLM'
    };
  }

  async getCurrentBlock(): Promise<number> {
    try {
      const latestLedger = await this.server.ledgers().order('desc').limit(1).call();
      return latestLedger.records[0]?.sequence || 0;
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get current Stellar ledger',
        'BLOCK_CHECK_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  async getBlockTimestamp(blockNumber: number): Promise<Date> {
    try {
      const ledger = await this.server.ledgers().ledger(blockNumber).call();
      return new Date(ledger.closed_at);
    } catch (error: any) {
      throw new BlockchainErrorImpl(
        error.message || 'Failed to get Stellar ledger timestamp',
        'BLOCK_TIMESTAMP_FAILED',
        this.network,
        undefined,
        error
      );
    }
  }

  validateAddress(address: string): boolean {
    try {
      // Stellar addresses are 56 characters starting with 'G'
      return /^G[A-Z0-9]{55}$/.test(address);
    } catch {
      return false;
    }
  }

  formatAmount(amount: string, decimals: number): string {
    try {
      return (parseFloat(amount) / Math.pow(10, decimals)).toString();
    } catch {
      return '0';
    }
  }

  parseAmount(formattedAmount: string, decimals: number): string {
    try {
      return (parseFloat(formattedAmount) * Math.pow(10, decimals)).toString();
    } catch {
      return '0';
    }
  }

  onTransactionUpdate(hash: string, callback: (tx: TransactionResponse) => void): void {
    // Implementation would use Stellar streaming
    console.log(`Transaction update listener set for hash: ${hash}`);
  }

  onNetworkChange(callback: (network: BlockchainNetwork) => void): void {
    console.log('Network change listener set');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const latestLedger = await this.server.ledgers().order('desc').limit(1).call();
      
      return {
        healthy: true,
        details: {
          latestLedger: latestLedger.records[0]?.sequence,
          horizonUrl: this.config.rpcUrl,
          network: this.config.environment
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
      isConnected: this._isConnected,
      hasKeypair: this.keypair !== null,
      config: {
        environment: this.config.environment,
        horizonUrl: this.config.rpcUrl,
        passphrase: this.config.passphrase
      }
    };
  }

  // Helper methods for extracting transaction details
  private extractDestination(transaction: any): string {
    if (transaction.operations && transaction.operations.length > 0) {
      const paymentOp = transaction.operations.find((op: any) => op.type === 'payment');
      return paymentOp?.to || '';
    }
    return '';
  }

  private extractAmount(transaction: any): string {
    if (transaction.operations && transaction.operations.length > 0) {
      const paymentOp = transaction.operations.find((op: any) => op.type === 'payment');
      return paymentOp?.amount || '0';
    }
    return '0';
  }

  private extractAsset(transaction: any): string {
    if (transaction.operations && transaction.operations.length > 0) {
      const paymentOp = transaction.operations.find((op: any) => op.type === 'payment');
      if (paymentOp?.asset_type === 'native') {
        return 'XLM';
      }
      return paymentOp?.asset_code || 'XLM';
    }
    return 'XLM';
  }
}
