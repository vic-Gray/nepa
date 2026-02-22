import { useState, useEffect } from 'react';
import type { WalletState, WalletProvider, TransactionHistory, PaymentFormData } from '../types';
import { TransactionStep } from '../types';
import { NetworkStatusService, NetworkStatus } from '../services/networkStatusService';
import { ErrorHandler } from '../utils/errorHandler';

export const useWallet = () => {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: "0.00",
    provider: null,
    status: 'idle',
    currentStep: TransactionStep.IDLE,
    txHash: null,
    history: [
        { id: '1', amount: '50.00', meter: '62140098721', date: '2024-02-18', status: 'completed' },
        { id: '2', amount: '12.00', meter: '62140098721', date: '2024-02-15', status: 'completed' }
    ],
    error: null,
  });

  const [networkService] = useState(() => new NetworkStatusService());
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const unsubscribe = networkService.onStatusChange((status) => {
      if (status === NetworkStatus.OFFLINE) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'You are currently offline. Please check your internet connection.'
        }));
      }
    });

    return unsubscribe;
  }, [networkService]);

  const connect = async (provider: WalletProvider) => {
    if (!networkService.isOnline()) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Cannot connect wallet while offline. Please check your internet connection.'
      }));
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', currentStep: TransactionStep.CONNECTING, error: null }));
    
    try {
      await ErrorHandler.retryWithBackoff(async () => {
        // Simulate wallet connection with error scenarios
        if (Math.random() < 0.1) { // 10% chance of network error
          throw new Error('Network connection failed');
        }
        
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        const mockAddr = provider === 'freighter' ? 'GCF...RTR' : provider === 'albedo' ? 'GBA...ALB' : 'GWC...WCN';
        return { address: mockAddr, balance: "142.50" };
      }, {
        maxRetries: 3,
        baseDelay: 1000
      });
      
      const mockAddr = provider === 'freighter' ? 'GCF...RTR' : provider === 'albedo' ? 'GBA...ALB' : 'GWC...WCN';
      setState(prev => ({ 
        ...prev, 
        address: mockAddr, 
        balance: "142.50", 
        provider, 
        status: 'idle', 
        currentStep: TransactionStep.IDLE 
      }));
      setRetryCount(0);
    } catch (error) {
      const networkError = ErrorHandler.classifyError(error);
      const errorMessage = ErrorHandler.createUserFriendlyMessage(networkError);
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      
      setRetryCount(prev => prev + 1);
    }
  };

  const sendPayment = async (data: PaymentFormData) => {
    if (!networkService.isOnline()) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Cannot send payment while offline. Please check your internet connection.'
      }));
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', currentStep: TransactionStep.SIGNING, error: null }));
    
    try {
      await ErrorHandler.retryWithBackoff(async () => {
        // Validate payment data
        if (!data.amount || !data.meterNumber) {
          throw new Error('Invalid payment data: amount and meter number are required');
        }
        
        if (parseFloat(data.amount) <= 0) {
          throw new Error('Payment amount must be greater than 0');
        }
        
        // Simulate multi-step transaction process
        setState(prev => ({ ...prev, currentStep: TransactionStep.SIGNING }));
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (Math.random() < 0.1) { // 10% chance of signing error
          throw new Error('Transaction signing failed');
        }
        
        setState(prev => ({ ...prev, currentStep: TransactionStep.SUBMITTING }));
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (Math.random() < 0.15) { // 15% chance of submission error
          if (Math.random() < 0.5) {
            throw new Error('Network timeout during submission');
          } else {
            throw new Error('Transaction rejected by network');
          }
        }
        
        setState(prev => ({ ...prev, currentStep: TransactionStep.FINALIZING }));
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (Math.random() < 0.05) { // 5% chance of finalization error
          throw new Error('Transaction finalization failed');
        }
        
        return { 
          success: true, 
          transactionHash: "7b4c...f2e1",
          id: Math.random().toString(36).substr(2, 9)
        };
      }, {
        maxRetries: 3,
        baseDelay: 1500,
        maxDelay: 15000
      });
      
      const newTx: TransactionHistory = {
        id: Math.random().toString(36).substr(2, 9),
        amount: data.amount,
        meter: data.meterNumber || 'unknown',
        date: new Date().toISOString().split('T')[0],
        status: 'completed'
      };
      
      setState(prev => ({ 
        ...prev, 
        status: 'success', 
        currentStep: TransactionStep.COMPLETE, 
        txHash: "7b4c...f2e1", 
        history: [newTx, ...prev.history] 
      }));
      setRetryCount(0);
    } catch (error) {
      const networkError = ErrorHandler.classifyError(error);
      const errorMessage = ErrorHandler.createUserFriendlyMessage(networkError);
      
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      
      setRetryCount(prev => prev + 1);
    }
  };

  const disconnect = () => setState(prev => ({ ...prev, address: null, provider: null, history: [] }));
  const reset = () => setState(prev => ({ ...prev, status: 'idle', currentStep: TransactionStep.IDLE, error: null }));

  const retryLastOperation = () => {
    if (state.error && retryCount < 3) {
      // Clear error and let user retry the operation
      setState(prev => ({ ...prev, error: null }));
    }
  };

  return { 
    ...state, 
    connect, 
    disconnect, 
    sendPayment, 
    reset,
    retryLastOperation,
    networkStatus: networkService.getStatus(),
    isOnline: networkService.isOnline(),
    retryCount
  };
};
