import React, { useState, useEffect } from 'react';
import { BlockchainNetwork, BlockchainManager } from '../blockchain';
import { createBlockchainManager, getDefaultConfigs, NetworkEnvironment } from '../blockchain';

interface NetworkSelectorProps {
  onNetworkChange: (network: BlockchainNetwork) => void;
  onConnected: (connection: any) => void;
  environment?: NetworkEnvironment;
  className?: string;
}

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  onNetworkChange,
  onConnected,
  environment = NetworkEnvironment.TESTNET,
  className = ''
}) => {
  const [selectedNetwork, setSelectedNetwork] = useState<BlockchainNetwork>(BlockchainNetwork.STELLAR);
  const [blockchainManager, setBlockchainManager] = useState<BlockchainManager | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const networks = [
    {
      network: BlockchainNetwork.STELLAR,
      name: 'Stellar',
      description: 'Fast, low-cost payments',
      icon: '⭐',
      color: 'bg-blue-500'
    },
    {
      network: BlockchainNetwork.ETHEREUM,
      name: 'Ethereum',
      description: 'Smart contract platform',
      icon: '🔷',
      color: 'bg-purple-500'
    },
    {
      network: BlockchainNetwork.POLYGON,
      name: 'Polygon',
      description: 'Scalable Ethereum sidechain',
      icon: '🟣',
      color: 'bg-indigo-500'
    }
  ];

  useEffect(() => {
    // Initialize blockchain manager with default configs
    const configs = getDefaultConfigs(environment);
    const manager = createBlockchainManager(configs);
    setBlockchainManager(manager);

    // Set up event listeners
    manager.on('connected', ({ connection }) => {
      setIsConnected(true);
      setCurrentAccount(connection.address);
      onConnected(connection);
      setError(null);
    });

    manager.on('disconnected', () => {
      setIsConnected(false);
      setCurrentAccount(null);
    });

    manager.on('connectionError', ({ error: err }) => {
      setError(err.message);
      setIsConnecting(false);
    });

    return () => {
      // Cleanup if needed
    };
  }, [environment, onConnected]);

  const handleNetworkSelect = (network: BlockchainNetwork) => {
    setSelectedNetwork(network);
    onNetworkChange(network);
    
    // Disconnect from current network if connected
    if (isConnected && blockchainManager) {
      blockchainManager.disconnect().then(() => {
        setIsConnected(false);
        setCurrentAccount(null);
      });
    }
  };

  const handleConnect = async () => {
    if (!blockchainManager) {
      setError('Blockchain manager not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await blockchainManager.connect(selectedNetwork);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!blockchainManager) return;

    try {
      await blockchainManager.disconnect();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-xl font-bold mb-4">Select Blockchain Network</h2>
      
      {/* Network Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {networks.map(({ network, name, description, icon, color }) => (
          <div
            key={network}
            onClick={() => handleNetworkSelect(network)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedNetwork === network
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-2">{icon}</span>
              <h3 className="font-semibold">{name}</h3>
            </div>
            <p className="text-sm text-gray-600">{description}</p>
            {selectedNetwork === network && (
              <div className={`mt-2 h-1 ${color} rounded`}></div>
            )}
          </div>
        ))}
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        {isConnected ? (
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-green-700">
                Connected to {networks.find(n => n.network === selectedNetwork)?.name}
              </span>
              {currentAccount && (
                <span className="ml-2 text-sm text-gray-600">
                  ({formatAddress(currentAccount)})
                </span>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                isConnecting
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isConnecting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </span>
              ) : (
                `Connect to ${networks.find(n => n.network === selectedNetwork)?.name}`
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Network Information */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Network Information</h3>
        <div className="text-sm text-gray-600">
          <p><strong>Environment:</strong> {environment}</p>
          <p><strong>Selected Network:</strong> {networks.find(n => n.network === selectedNetwork)?.name}</p>
          <p><strong>Status:</strong> {isConnected ? 'Connected' : 'Not Connected'}</p>
        </div>
      </div>
    </div>
  );
};

export default NetworkSelector;
