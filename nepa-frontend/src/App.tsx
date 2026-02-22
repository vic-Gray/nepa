import { useState } from 'react';
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import * as NepaClient from './contracts';
import YieldDashboard from './components/YieldDashboard';
import MobileNavigation from './components/MobileNavigation';

function App() {
  const [currentView, setCurrentView] = useState<'payment' | 'yield'>('payment');
  const [meterId, setMeterId] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const handlePayment = async () => {
    // 1. Check if the user has Freighter wallet installed
    if (!(await isConnected())) {
      setStatus("Please install Freighter Wallet extension in your browser!");
      return;
    }

    try {
      setStatus("Connecting to wallet...");
      // 2. Ask the user to connect their wallet and get their public key
      const publicKey = await requestAccess();

      // 3. Initialize the Nepa Smart Contract Client
      const client = new NepaClient.Client({
        ...NepaClient.networks.testnet,
        rpcUrl: 'https://soroban-testnet.stellar.org:443',
      });

      setStatus("Preparing transaction... Please approve in Freighter.");

      // Convert standard XLM input to stroops (7 decimal places)
      const amountBigInt = BigInt(parseFloat(amount) * 10_000_000);

      // 4. Call the pay_bill function on the contract
      const tx = await client.pay_bill({
        from: publicKey,
        token_address: "CAS3J7GYCCXG7M35I6K3SOW66FQHS6CJ5U7DECO3SSTH4XNMQ66S23P2", // Native XLM on Testnet
        meter_id: meterId,
        amount: amountBigInt
      });

      // 5. Send the transaction to the Freighter wallet for the user to sign
      const { result } = await tx.signAndSend({
        signTransaction: async (transactionXdr) => {
          const signedTx = await signTransaction(transactionXdr, { network: "TESTNET" });
          return signedTx as string; // Freighter returns the signed XDR string
        }
      });

      setStatus(`Success! Payment of ${amount} XLM confirmed for ${meterId}.`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Payment failed: ${err.message || "Check console for details."}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileNavigation currentView={currentView} onViewChange={setCurrentView} />
      
      <div className="p-4 pt-0 lg:pt-8 lg:px-8 font-sans">
        {currentView === 'payment' ? (
          <div className="w-full max-w-md mx-auto sm:max-w-lg lg:max-w-xl">
            <div className="text-center mb-8 mt-8 lg:mt-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-600 mb-2">
                NEPA 💡
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Decentralized Utility Payments
              </p>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="relative">
                <label htmlFor="meterId" className="block text-sm font-medium text-gray-700 mb-2">
                  Meter Number
                </label>
                <input
                  id="meterId"
                  className="w-full px-4 py-4 text-base sm:text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all touch-manipulation"
                  placeholder="e.g. METER-123"
                  value={meterId}
                  onChange={(e: any) => setMeterId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="relative">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (XLM)
                </label>
                <input
                  id="amount"
                  className="w-full px-4 py-4 text-base sm:text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all touch-manipulation"
                  placeholder="0.00"
                  type="number"
                  step="0.0000001"
                  min="0"
                  value={amount}
                  onChange={(e: any) => setAmount(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button
                onClick={handlePayment}
                disabled={!meterId || !amount || parseFloat(amount) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-all touch-manipulation shadow-lg text-base sm:text-lg min-h-[48px] active:scale-95"
              >
                Pay Electricity Bill
              </button>
            </div>

            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-100 rounded-lg min-h-[60px]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-gray-800 mb-2 sm:mb-0">Status:</span>
                <span className="text-gray-700 text-sm sm:text-base break-words">{status || 'Ready'}</span>
              </div>
            </div>
          </div>
        ) : (
          <YieldDashboard />
        )}
      </div>
    </div>
  );
}

export default App;
