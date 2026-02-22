import { useState, useEffect } from 'react';
import type { StellarState, PaymentFormData } from '../types';
import { NetworkStatusService, NetworkStatus } from '../services/networkStatusService';
import { ErrorHandler } from '../utils/errorHandler';

export const useStellar = () => {
  const [state, setState] = useState<StellarState>({
    address: null,
    status: 'idle',
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

  const connectWallet = async () => {
    if (!networkService.isOnline()) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Cannot connect wallet while offline. Please check your internet connection.'
      }));
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', error: null }));
    
    try {
      await ErrorHandler.retryWithBackoff(async () => {
        // Simulate wallet connection with realistic error scenarios
        if (Math.random() < 0.1) { // 10% chance of network error
          throw new Error('Network connection failed');
        }
        
        // Simulate connection delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return { address: "G...NEPA" };
      }, {
        maxRetries: 3,
        baseDelay: 1000
      });
      
      setState({ address: "G...NEPA", status: 'idle', error: null });
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

    setState(prev => ({ ...prev, status: 'loading', error: null }));
    
    try {
      await ErrorHandler.retryWithBackoff(async () => {
        console.log("Processing Transaction:", data);
        
        // Validate payment data
        if (!data.destination || !data.amount) {
          throw new Error('Invalid payment data: destination and amount are required');
        }
        
        if (parseFloat(data.amount) <= 0) {
          throw new Error('Payment amount must be greater than 0');
        }
        
        // Simulate transaction processing
        if (Math.random() < 0.15) { // 15% chance of failure
          if (Math.random() < 0.5) {
            throw new Error('Network timeout');
          } else {
            throw new Error('Transaction failed');
          }
        }
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return { success: true, transactionHash: 'tx_' + Math.random().toString(36).substr(2, 9) };
      }, {
        maxRetries: 3,
        baseDelay: 1500,
        maxDelay: 10000
      });
      
      setState(prev => ({ ...prev, status: 'success' }));
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

  const retryLastOperation = () => {
    if (state.error && retryCount < 3) {
      // This would ideally retry the last failed operation
      // For now, we'll just clear the error and let the user try again
      setState(prev => ({ ...prev, error: null }));
    }
  };

  return { 
    ...state, 
    connectWallet, 
    sendPayment,
    retryLastOperation,
    networkStatus: networkService.getStatus(),
    isOnline: networkService.isOnline(),
    retryCount
  };
};
