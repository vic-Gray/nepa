import React, { useState } from 'react';
import { useWallet } from './hooks/useWallet';
import { WalletModal } from './components/WalletModal';
import { TransactionHistory } from './components/TransactionHistory';
import { PaymentForm } from './components/PaymentForm';
import { ProgressStepper } from './components/ProgressStepper';
import { Loading } from './components/Loading';

const App: React.FC = () => {
  const { address, balance, provider, history, status, currentStep, txHash, connect, disconnect, sendPayment, reset } = useWallet();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-md space-y-6">
        <header className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">N</div>
             {address && (
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{provider}</p>
                 <p className="text-sm font-black text-slate-800">{balance} XLM</p>
               </div>
             )}
          </div>
          {address ? (
            <button onClick={disconnect} className="text-[10px] font-bold text-red-400">DISCONNECT</button>
          ) : (
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl">CONNECT</button>
          )}
        </header>

        <main className="bg-white rounded-[2rem] shadow-xl border border-slate-200 p-6">
           {address ? (
             <>
                {status === 'loading' ? (
                    <div className="py-12 space-y-6">
                        <Loading label="Processing..." />
                        <ProgressStepper currentStep={currentStep} />
                    </div>
                ) : status === 'success' ? (
                    <div className="py-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
                        <h3 className="font-black text-slate-800">Payment Sent</h3>
                        <code className="text-[10px] text-blue-600 block bg-slate-50 p-2 rounded">{txHash}</code>
                        <button onClick={reset} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">New Payment</button>
                    </div>
                ) : (
                    <>
                        <h2 className="text-xl font-black text-slate-800 mb-6">Pay Electricity Bill</h2>
                        <PaymentForm onSubmit={sendPayment} isLoading={false} />
                        <TransactionHistory history={history} />
                    </>
                )}
             </>
           ) : (
             <div className="text-center py-12">
                <h2 className="text-2xl font-black text-slate-800 mb-2">Welcome to NEPA</h2>
                <p className="text-slate-400 text-sm mb-8">Connect your Stellar wallet to start paying bills.</p>
                <button onClick={() => setShowModal(true)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black">CONNECT WALLET</button>
             </div>
           )}
        </main>
        {showModal && <WalletModal onSelect={(p) => { connect(p); setShowModal(false); }} onClose={() => setShowModal(false)} />}
      </div>
    </div>
  );
};
export default App;
