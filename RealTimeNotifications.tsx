import React, { useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { toast } from 'react-hot-toast'; // Assuming react-hot-toast is used

interface Props {
  token: string | null;
}

export const RealTimeNotifications: React.FC<Props> = ({ token }) => {
  const { isConnected, subscribe } = useSocket({ token });

  useEffect(() => {
    if (!isConnected) return;

    // Handle Payment Success
    const unsubscribeSuccess = subscribe('payment_success', (data: any) => {
      toast.success(
        <div>
          <p className="font-bold">Payment Successful!</p>
          <p className="text-sm">Transaction {data.transactionId} confirmed.</p>
          <p className="text-xs mt-1">Amount: ₦{data.amount}</p>
        </div>,
        { duration: 5000, position: 'top-right' }
      );
      
      // Optional: Refresh data logic here
      // queryClient.invalidateQueries('transactions');
    });

    // Handle Payment Failure
    const unsubscribeFailure = subscribe('payment_failed', (data: any) => {
      toast.error(
        <div>
          <p className="font-bold">Payment Failed</p>
          <p className="text-sm">{data.reason}</p>
        </div>,
        { duration: 6000 }
      );
    });

    // Handle Bill Generation
    const unsubscribeBill = subscribe('bill_generated', (data: any) => {
      toast(
        <div>
          <p className="font-bold">New Bill Available</p>
          <p className="text-sm">{data.utilityName}: ₦{data.amount}</p>
        </div>,
        { icon: '📄', duration: 4000 }
      );
    });

    return () => {
      unsubscribeSuccess();
      unsubscribeFailure();
      unsubscribeBill();
    };
  }, [isConnected, subscribe]);

  // Render connection status indicator (optional, for debugging or UI)
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className={`fixed bottom-2 right-2 w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} 
           title={isConnected ? "Real-time connected" : "Disconnected"} 
      />
    );
  }

  return null;
};