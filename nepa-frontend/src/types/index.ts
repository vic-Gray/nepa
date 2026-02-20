export type WalletProvider = 'freighter' | 'albedo' | 'walletconnect' | null;
export type TransactionStatus = 'idle' | 'loading' | 'success' | 'error';
export enum TransactionStep { IDLE = 0, CONNECTING = 1, SIGNING = 2, SUBMITTING = 3, FINALIZING = 4, COMPLETE = 5 }

export interface TransactionHistory {
  id: string;
  amount: string;
  meter: string;
  date: string;
  status: 'completed' | 'failed';
}

export interface WalletState {
  address: string | null;
  balance: string | null;
  provider: WalletProvider;
  status: TransactionStatus;
  currentStep: TransactionStep;
  txHash: string | null;
  history: TransactionHistory[];
  error: string | null;
}

export interface PaymentFormData { meterNumber: string; amount: string; }
