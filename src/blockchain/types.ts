export enum BlockchainNetwork {
  STELLAR = 'stellar',
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  BSC = 'bsc',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism'
}

export enum NetworkEnvironment {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
  DEVNET = 'devnet'
}

export interface BlockchainConfig {
  network: BlockchainNetwork;
  environment: NetworkEnvironment;
  rpcUrl: string;
  wsUrl?: string;
  chainId?: number;
  blockExplorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  gasSettings?: {
    maxGasPrice?: string;
    gasMultiplier?: number;
  };
}

export interface WalletConnection {
  address: string;
  network: BlockchainNetwork;
  chainId?: number;
  isConnected: boolean;
}

export interface TransactionRequest {
  from: string;
  to: string;
  amount: string;
  asset?: string;
  memo?: string;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface TransactionResponse {
  hash: string;
  status: TransactionStatus;
  from: string;
  to: string;
  amount: string;
  asset?: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  blockHash?: string;
  timestamp?: Date;
  confirmations?: number;
  fee?: string;
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Balance {
  address: string;
  asset: string;
  amount: string;
  decimals: number;
  formatted: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
  formattedCost: string;
  currency: string;
}

export interface NetworkFeeInfo {
  slow: {
    gasPrice: string;
    estimatedTime: number; // in minutes
  };
  standard: {
    gasPrice: string;
    estimatedTime: number;
  };
  fast: {
    gasPrice: string;
    estimatedTime: number;
  };
  currency: string;
}

export interface BlockchainProvider {
  readonly network: BlockchainNetwork;
  readonly config: BlockchainConfig;
  
  // Connection methods
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getAccount(): Promise<string | null>;
  
  // Transaction methods
  sendTransaction(request: TransactionRequest): Promise<TransactionResponse>;
  estimateGas(request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>): Promise<GasEstimate>;
  getTransactionStatus(hash: string): Promise<TransactionResponse>;
  waitForTransaction(hash: string, confirmations?: number): Promise<TransactionResponse>;
  
  // Balance methods
  getBalance(address: string, asset?: string): Promise<Balance>;
  getMultipleBalances(address: string, assets: string[]): Promise<Balance[]>;
  
  // Network methods
  getNetworkFeeInfo(): Promise<NetworkFeeInfo>;
  getCurrentBlock(): Promise<number>;
  getBlockTimestamp(blockNumber: number): Promise<Date>;
  
  // Utility methods
  validateAddress(address: string): boolean;
  formatAmount(amount: string, decimals: number): string;
  parseAmount(formattedAmount: string, decimals: number): string;
  
  // Events
  onTransactionUpdate?(hash: string, callback: (tx: TransactionResponse) => void): void;
  onNetworkChange?(callback: (network: BlockchainNetwork) => void): void;
}

export interface CrossChainTransaction {
  id: string;
  fromNetwork: BlockchainNetwork;
  toNetwork: BlockchainNetwork;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  status: CrossChainStatus;
  sourceTransactionHash?: string;
  destinationTransactionHash?: string;
  bridgeContract?: string;
  estimatedCompletion?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum CrossChainStatus {
  INITIATED = 'initiated',
  SOURCE_CONFIRMED = 'source_confirmed',
  BRIDGE_PROCESSING = 'bridge_processing',
  DESTINATION_PENDING = 'destination_pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export interface BridgeProvider {
  name: string;
  supportedNetworks: [BlockchainNetwork, BlockchainNetwork][];
  
  estimateBridgeFee(request: CrossChainRequest): Promise<string>;
  initiateBridge(request: CrossChainRequest): Promise<CrossChainTransaction>;
  getBridgeStatus(transactionId: string): Promise<CrossChainTransaction>;
  getSupportedAssets(fromNetwork: BlockchainNetwork, toNetwork: BlockchainNetwork): Promise<string[]>;
}

export interface CrossChainRequest {
  fromNetwork: BlockchainNetwork;
  toNetwork: BlockchainNetwork;
  fromAddress: string;
  toAddress: string;
  amount: string;
  asset: string;
  slippageTolerance?: number; // in percentage
}

export interface BlockchainError extends Error {
  code: string;
  network: BlockchainNetwork;
  transactionHash?: string;
  details?: any;
}

export class BlockchainErrorImpl extends Error implements BlockchainError {
  code: string;
  network: BlockchainNetwork;
  transactionHash?: string;
  details?: any;

  constructor(message: string, code: string, network: BlockchainNetwork, transactionHash?: string, details?: any) {
    super(message);
    this.name = 'BlockchainError';
    this.code = code;
    this.network = network;
    this.transactionHash = transactionHash;
    this.details = details;
  }
}

export interface PaymentNotification {
  type: 'payment_sent' | 'payment_received' | 'payment_failed' | 'payment_confirmed';
  transaction: TransactionResponse;
  network: BlockchainNetwork;
  timestamp: Date;
  message: string;
}
