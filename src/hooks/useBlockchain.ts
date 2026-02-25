import { useState, useEffect, useCallback } from 'react';
import { 
  BlockchainManager, 
  BlockchainNetwork, 
  TransactionRequest, 
  TransactionResponse, 
  WalletConnection,
  Balance,
  GasEstimate,
  NetworkFeeInfo,
  BlockchainErrorImpl,
  createBlockchainManager,
  getDefaultConfigs,
  NetworkEnvironment
} from '../blockchain';

interface UseBlockchainOptions {
  environment?: NetworkEnvironment;
  autoConnect?: boolean;
  defaultNetwork?: BlockchainNetwork;
}

interface UseBlockchainState {
  manager: BlockchainManager | null;
  currentNetwork: BlockchainNetwork | null;
  isConnected: boolean;
  isConnecting: boolean;
  account: string | null;
  balance: Balance | null;
  error: string | null;
  supportedNetworks: BlockchainNetwork[];
}

interface UseBlockchainActions {
  connect: (network: BlockchainNetwork) => Promise<WalletConnection>;
  disconnect: () => Promise<void>;
  switchNetwork: (network: BlockchainNetwork) => Promise<WalletConnection>;
  sendTransaction: (request: TransactionRequest) => Promise<TransactionResponse>;
  estimateGas: (request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>) => Promise<GasEstimate>;
  getBalance: (address?: string, asset?: string) => Promise<Balance>;
  getNetworkFeeInfo: () => Promise<NetworkFeeInfo>;
  validateAddress: (address: string) => boolean;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

export const useBlockchain = (options: UseBlockchainOptions = {}): UseBlockchainState & UseBlockchainActions => {
  const {
    environment = NetworkEnvironment.TESTNET,
    autoConnect = false,
    defaultNetwork = BlockchainNetwork.STELLAR
  } = options;

  const [state, setState] = useState<UseBlockchainState>({
    manager: null,
    currentNetwork: null,
    isConnected: false,
    isConnecting: false,
    account: null,
    balance: null,
    error: null,
    supportedNetworks: []
  });

  // Initialize blockchain manager
  useEffect(() => {
    const configs = getDefaultConfigs(environment);
    const manager = createBlockchainManager(configs);
    
    setState(prev => ({
      ...prev,
      manager,
      supportedNetworks: manager.getSupportedNetworks(),
      currentNetwork: defaultNetwork
    }));

    // Set up event listeners
    const handleConnected = ({ connection }: { connection: WalletConnection }) => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        account: connection.address,
        currentNetwork: connection.network,
        error: null
      }));
    };

    const handleDisconnected = () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        account: null,
        balance: null
      }));
    };

    const handleConnectionError = ({ error }: { error: BlockchainErrorImpl }) => {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message
      }));
    };

    const handleTransactionUpdate = ({ transaction }: { transaction: TransactionResponse }) => {
      // Could update transaction state here if needed
      console.log('Transaction update:', transaction);
    };

    manager.on('connected', handleConnected);
    manager.on('disconnected', handleDisconnected);
    manager.on('connectionError', handleConnectionError);
    manager.on('transactionUpdate', handleTransactionUpdate);

    // Auto-connect if enabled
    if (autoConnect) {
      connect(defaultNetwork);
    }

    return () => {
      // Cleanup event listeners if needed
    };
  }, [environment, autoConnect, defaultNetwork]);

  const connect = useCallback(async (network: BlockchainNetwork): Promise<WalletConnection> => {
    if (!state.manager) {
      throw new Error('Blockchain manager not initialized');
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const connection = await state.manager.connect(network);
      return connection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({ ...prev, error: errorMessage, isConnecting: false }));
      throw error;
    }
  }, [state.manager]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (!state.manager) return;

    try {
      await state.manager.disconnect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Disconnection failed';
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [state.manager]);

  const switchNetwork = useCallback(async (network: BlockchainNetwork): Promise<WalletConnection> => {
    if (!state.manager) {
      throw new Error('Blockchain manager not initialized');
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const connection = await state.manager.switchNetwork(network);
      return connection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network switch failed';
      setState(prev => ({ ...prev, error: errorMessage, isConnecting: false }));
      throw error;
    }
  }, [state.manager]);

  const sendTransaction = useCallback(async (request: TransactionRequest): Promise<TransactionResponse> => {
    if (!state.manager) {
      throw new Error('Blockchain manager not initialized');
    }

    try {
      const response = await state.manager.sendTransaction(request);
      setState(prev => ({ ...prev, error: null }));
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.manager]);

  const estimateGas = useCallback(async (request: Omit<TransactionRequest, 'gasLimit' | 'gasPrice'>): Promise<GasEstimate> => {
    if (!state.manager) {
      throw new Error('Blockchain manager not initialized');
    }

    try {
      return await state.manager.estimateGas(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gas estimation failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.manager]);

  const getBalance = useCallback(async (address?: string, asset?: string): Promise<Balance> => {
    if (!state.manager) {
      throw new Error('Blockchain manager not initialized');
    }

    try {
      const targetAddress = address || state.account;
      if (!targetAddress) {
        throw new Error('No address available');
      }

      const balance = await state.manager.getBalance(targetAddress, asset);
      setState(prev => ({ ...prev, balance, error: null }));
      return balance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Balance check failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.manager, state.account]);

  const getNetworkFeeInfo = useCallback(async (): Promise<NetworkFeeInfo> => {
    if (!state.manager) {
      throw new Error('Blockchain manager not initialized');
    }

    try {
      return await state.manager.getNetworkFeeInfo();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fee info fetch failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.manager]);

  const validateAddress = useCallback((address: string): boolean => {
    if (!state.manager) return false;
    return state.manager.validateAddress(address);
  }, [state.manager]);

  const refreshBalance = useCallback(async (): Promise<void> => {
    if (state.account) {
      await getBalance(state.account);
    }
  }, [state.account, getBalance]);

  const clearError = useCallback((): void => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Auto-refresh balance when account changes
  useEffect(() => {
    if (state.account && state.isConnected) {
      refreshBalance();
    }
  }, [state.account, state.isConnected, refreshBalance]);

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    sendTransaction,
    estimateGas,
    getBalance,
    getNetworkFeeInfo,
    validateAddress,
    refreshBalance,
    clearError
  };
};

export default useBlockchain;
