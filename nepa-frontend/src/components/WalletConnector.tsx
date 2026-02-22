import React from 'react';

interface Props {
  address: string | null;
  onConnect: () => void;
}

export const WalletConnector: React.FC<Props> = ({ address, onConnect }) => (
  <div className="wallet-connector">
    {address ? (
      <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <p className="text-xs sm:text-sm font-medium text-green-800 hidden xs:block">
          {address.slice(0, 6)}...{address.slice(-4)}
        </p>
        <p className="text-xs sm:text-sm font-medium text-green-800 xs:hidden">
          {address.slice(0, 4)}...{address.slice(-3)}
        </p>
      </div>
    ) : (
      <button 
        onClick={onConnect}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg transition-colors duration-200 min-h-[44px] touch-manipulation transform active:scale-95 shadow-sm hover:shadow-md"
      >
        <span className="hidden xs:inline">Connect Wallet</span>
        <span className="xs:hidden">Connect</span>
      </button>
    )}
  </div>
);
