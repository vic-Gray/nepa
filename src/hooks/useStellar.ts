import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StellarState, PaymentFormData } from '../types';

/**
 * Custom hook for Stellar blockchain operations
 * Handles wallet connection and payment logic with i18n support
 */
export const useStellar = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<StellarState>({
    address: null,
    balance: null,
    status: 'idle',
    error: null,
  });

  const connectWallet = async () => {
    setState(prev => ({ ...prev, status: 'loading', error: null }));
    try {
      // Mocking connection - Replace with actual Freighter API call
      const mockAddress = "GA...XYZ"; 
      setState({ address: mockAddress, balance: "100.00", status: 'idle', error: null });
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: t('wallet.connection_failed') 
      }));
    }
  };

  const sendPayment = async (data: PaymentFormData) => {
    setState(prev => ({ ...prev, status: 'loading', error: null }));
    try {
      console.log("Sending payment to:", data.destination, "Amount:", data.amount);
      // Actual Stellar Transaction Logic goes here
      setState(prev => ({ ...prev, status: 'success' }));
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: t('payment.transaction_failed') 
      }));
    }
  };

  return { ...state, connectWallet, sendPayment };
};
