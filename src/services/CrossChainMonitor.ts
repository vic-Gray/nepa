import { 
  BlockchainNetwork, 
  CrossChainTransaction, 
  CrossChainStatus,
  TransactionResponse,
  BridgeProvider,
  BlockchainErrorImpl,
  BlockchainManager
} from '../blockchain';

export interface CrossChainMonitorOptions {
  checkInterval?: number; // in milliseconds
  maxRetries?: number;
  timeout?: number; // in milliseconds
  enableNotifications?: boolean;
}

export interface CrossChainEvent {
  type: 'status_update' | 'completion' | 'failure' | 'timeout';
  transaction: CrossChainTransaction;
  timestamp: Date;
  details?: any;
}

export class CrossChainMonitor {
  private blockchainManager: BlockchainManager;
  private bridgeProviders: Map<string, BridgeProvider> = new Map();
  private monitoredTransactions: Map<string, CrossChainTransaction> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private options: Required<CrossChainMonitorOptions>;

  constructor(blockchainManager: BlockchainManager, options: CrossChainMonitorOptions = {}) {
    this.blockchainManager = blockchainManager;
    this.options = {
      checkInterval: 30000, // 30 seconds
      maxRetries: 10,
      timeout: 3600000, // 1 hour
      enableNotifications: true,
      ...options
    };
  }

  /**
   * Start monitoring a cross-chain transaction
   */
  startMonitoring(transaction: CrossChainTransaction): void {
    if (this.monitoredTransactions.has(transaction.id)) {
      console.warn(`Transaction ${transaction.id} is already being monitored`);
      return;
    }

    this.monitoredTransactions.set(transaction.id, { ...transaction });
    
    const interval = setInterval(() => {
      this.checkTransactionStatus(transaction.id);
    }, this.options.checkInterval);

    this.monitoringIntervals.set(transaction.id, interval);
    
    // Set timeout for the entire monitoring process
    setTimeout(() => {
      this.handleTimeout(transaction.id);
    }, this.options.timeout);

    this.emit('status_update', {
      transaction,
      timestamp: new Date(),
      details: { message: 'Monitoring started' }
    });
  }

  /**
   * Stop monitoring a transaction
   */
  stopMonitoring(transactionId: string): void {
    const interval = this.monitoringIntervals.get(transactionId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(transactionId);
    }

    this.monitoredTransactions.delete(transactionId);
    
    this.emit('status_update', {
      transaction: { id: transactionId } as CrossChainTransaction,
      timestamp: new Date(),
      details: { message: 'Monitoring stopped' }
    });
  }

  /**
   * Get status of a monitored transaction
   */
  getTransactionStatus(transactionId: string): CrossChainTransaction | null {
    return this.monitoredTransactions.get(transactionId) || null;
  }

  /**
   * Get all monitored transactions
   */
  getAllMonitoredTransactions(): CrossChainTransaction[] {
    return Array.from(this.monitoredTransactions.values());
  }

  /**
   * Get transactions by status
   */
  getTransactionsByStatus(status: CrossChainStatus): CrossChainTransaction[] {
    return Array.from(this.monitoredTransactions.values()).filter(
      tx => tx.status === status
    );
  }

  /**
   * Register a bridge provider
   */
  registerBridgeProvider(name: string, provider: BridgeProvider): void {
    this.bridgeProviders.set(name, provider);
  }

  /**
   * Manually update transaction status
   */
  async updateTransactionStatus(transactionId: string): Promise<CrossChainTransaction> {
    const transaction = this.monitoredTransactions.get(transactionId);
    if (!transaction) {
      throw new BlockchainErrorImpl(
        'Transaction not found in monitoring list',
        'TRANSACTION_NOT_FOUND',
        BlockchainNetwork.STELLAR
      );
    }

    return await this.checkTransactionStatus(transactionId);
  }

  /**
   * Check if a transaction is being monitored
   */
  isMonitoring(transactionId: string): boolean {
    return this.monitoredTransactions.has(transactionId);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    total: number;
    byStatus: Record<CrossChainStatus, number>;
    averageCompletionTime: number;
    successRate: number;
  } {
    const transactions = Array.from(this.monitoredTransactions.values());
    const byStatus = {} as Record<CrossChainStatus, number>;
    
    // Initialize all statuses to 0
    Object.values(CrossChainStatus).forEach(status => {
      byStatus[status] = 0;
    });

    transactions.forEach(tx => {
      byStatus[tx.status]++;
    });

    const completedTransactions = transactions.filter(tx => 
      tx.status === CrossChainStatus.COMPLETED
    );
    
    const averageCompletionTime = completedTransactions.length > 0
      ? completedTransactions.reduce((sum, tx) => {
          const time = tx.updatedAt.getTime() - tx.createdAt.getTime();
          return sum + time;
        }, 0) / completedTransactions.length
      : 0;

    const successRate = transactions.length > 0
      ? (completedTransactions.length / transactions.length) * 100
      : 0;

    return {
      total: transactions.length,
      byStatus,
      averageCompletionTime,
      successRate
    };
  }

  /**
   * Clean up completed/failed transactions older than specified time
   */
  cleanup(maxAge: number = 86400000): void { // 24 hours default
    const cutoffTime = new Date(Date.now() - maxAge);
    const transactionsToRemove: string[] = [];

    for (const [id, transaction] of this.monitoredTransactions) {
      const isFinalStatus = [
        CrossChainStatus.COMPLETED,
        CrossChainStatus.FAILED,
        CrossChainStatus.REFUNDED
      ].includes(transaction.status);

      if (isFinalStatus && transaction.updatedAt < cutoffTime) {
        transactionsToRemove.push(id);
      }
    }

    transactionsToRemove.forEach(id => {
      this.stopMonitoring(id);
    });

    console.log(`Cleaned up ${transactionsToRemove.length} old transactions`);
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

  private emit(event: string, data: CrossChainEvent): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in cross-chain monitor event listener:`, error);
        }
      });
    }
  }

  private async checkTransactionStatus(transactionId: string): Promise<CrossChainTransaction> {
    const transaction = this.monitoredTransactions.get(transactionId);
    if (!transaction) {
      return null as any;
    }

    try {
      // Find the appropriate bridge provider
      const bridgeProvider = this.findBridgeProvider(transaction.fromNetwork, transaction.toNetwork);
      if (!bridgeProvider) {
        throw new BlockchainErrorImpl(
          'No bridge provider found for this transaction',
          'NO_BRIDGE_PROVIDER',
          transaction.fromNetwork
        );
      }

      // Get updated status from bridge provider
      const updatedTransaction = await bridgeProvider.getBridgeStatus(transactionId);
      
      // Check if status has changed
      if (updatedTransaction.status !== transaction.status) {
        this.monitoredTransactions.set(transactionId, updatedTransaction);
        
        const eventType = this.getEventTypeFromStatus(updatedTransaction.status);
        this.emit(eventType, {
          transaction: updatedTransaction,
          timestamp: new Date()
        });

        // Stop monitoring if transaction is in final state
        if (this.isFinalStatus(updatedTransaction.status)) {
          this.stopMonitoring(transactionId);
        }
      }

      // Verify on-chain transactions if available
      await this.verifyOnChainTransactions(updatedTransaction);

      return updatedTransaction;
    } catch (error) {
      console.error(`Error checking transaction status for ${transactionId}:`, error);
      
      // Emit failure event
      this.emit('failure', {
        transaction,
        timestamp: new Date(),
        details: { error: error.message }
      });

      return transaction;
    }
  }

  private async verifyOnChainTransactions(transaction: CrossChainTransaction): Promise<void> {
    // Verify source transaction if hash is available
    if (transaction.sourceTransactionHash) {
      try {
        const sourceTx = await this.blockchainManager.getTransactionStatus(
          transaction.sourceTransactionHash,
          transaction.fromNetwork
        );
        
        if (sourceTx.status === 'failed') {
          // Update cross-chain transaction status to failed
          transaction.status = CrossChainStatus.FAILED;
          this.monitoredTransactions.set(transaction.id, transaction);
          
          this.emit('failure', {
            transaction,
            timestamp: new Date(),
            details: { reason: 'Source transaction failed' }
          });
        }
      } catch (error) {
        console.error('Error verifying source transaction:', error);
      }
    }

    // Verify destination transaction if hash is available
    if (transaction.destinationTransactionHash) {
      try {
        const destTx = await this.blockchainManager.getTransactionStatus(
          transaction.destinationTransactionHash,
          transaction.toNetwork
        );
        
        if (destTx.status === 'confirmed') {
          // Update cross-chain transaction status to completed
          transaction.status = CrossChainStatus.COMPLETED;
          transaction.updatedAt = new Date();
          this.monitoredTransactions.set(transaction.id, transaction);
          
          this.emit('completion', {
            transaction,
            timestamp: new Date()
          });
        } else if (destTx.status === 'failed') {
          transaction.status = CrossChainStatus.FAILED;
          this.monitoredTransactions.set(transaction.id, transaction);
          
          this.emit('failure', {
            transaction,
            timestamp: new Date(),
            details: { reason: 'Destination transaction failed' }
          });
        }
      } catch (error) {
        console.error('Error verifying destination transaction:', error);
      }
    }
  }

  private handleTimeout(transactionId: string): void {
    const transaction = this.monitoredTransactions.get(transactionId);
    if (!transaction) return;

    // Check if transaction is still being monitored (might have been completed)
    if (!this.monitoringIntervals.has(transactionId)) return;

    // Mark as failed due to timeout
    transaction.status = CrossChainStatus.FAILED;
    transaction.updatedAt = new Date();
    this.monitoredTransactions.set(transactionId, transaction);

    this.emit('timeout', {
      transaction,
      timestamp: new Date(),
      details: { timeout: this.options.timeout }
    });

    // Stop monitoring
    this.stopMonitoring(transactionId);
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

  private getEventTypeFromStatus(status: CrossChainStatus): 'status_update' | 'completion' | 'failure' {
    switch (status) {
      case CrossChainStatus.COMPLETED:
        return 'completion';
      case CrossChainStatus.FAILED:
      case CrossChainStatus.REFUNDED:
        return 'failure';
      default:
        return 'status_update';
    }
  }

  private isFinalStatus(status: CrossChainStatus): boolean {
    return [
      CrossChainStatus.COMPLETED,
      CrossChainStatus.FAILED,
      CrossChainStatus.REFUNDED
    ].includes(status);
  }

  /**
   * Stop all monitoring and clean up resources
   */
  destroy(): void {
    // Clear all intervals
    for (const interval of this.monitoringIntervals.values()) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();

    // Clear all data
    this.monitoredTransactions.clear();
    this.eventListeners.clear();
    this.bridgeProviders.clear();
  }
}
