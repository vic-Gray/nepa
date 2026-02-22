export type TransactionStatus = 'idle' | 'loading' | 'success' | 'error';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';

export enum TransactionStep {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  SIGNING = 'signing',
  SUBMITTING = 'submitting',
  FINALIZING = 'finalizing',
  COMPLETE = 'complete'
}

export type WalletProvider = 'freighter' | 'albedo' | 'walletconnect';

export interface TransactionHistory {
  id: string;
  amount: string;
  meter: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface WalletState {
  address: string | null;
  balance: string;
  provider: WalletProvider | null;
  status: TransactionStatus;
  currentStep: TransactionStep;
  txHash: string | null;
  history: TransactionHistory[];
  error: string | null;
}

export interface StellarState {
  address: string | null;
  status: TransactionStatus;
  error: string | null;
}

export interface PaymentFormData {
  destination: string;
  amount: string;
  meterNumber?: string;
}

export interface Transaction {
  id: string;
  amount: string;
  meterId: string;
  status: PaymentStatus;
  date: string;
  transactionHash?: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  fee?: string;
  recipient?: string;
}

export interface TransactionHistory {
  transactions: Transaction[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  meterId?: string;
  status?: PaymentStatus;
  minAmount?: string;
  maxAmount?: string;
  page?: number;
  limit?: number;
}

export interface ReceiptData {
  transaction: Transaction;
  receiptNumber: string;
  issuedAt: string;
  paymentMethod: string;
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
  };
}
