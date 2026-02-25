export * from './types';
export * from './BlockchainManager';
export * from './providers/EthereumProvider';
export * from './providers/PolygonProvider';
export * from './providers/StellarProvider';

// Factory function to create blockchain manager with default providers
import { BlockchainManager } from './BlockchainManager';
import { EthereumProvider, EthereumConfig } from './providers/EthereumProvider';
import { PolygonProvider, PolygonConfig } from './providers/PolygonProvider';
import { StellarProvider, StellarConfig } from './providers/StellarProvider';
import { BlockchainNetwork, NetworkEnvironment, BlockchainConfig } from './types';

export interface MultiChainConfig {
  ethereum?: EthereumConfig;
  polygon?: PolygonConfig;
  stellar?: StellarConfig;
}

export function createBlockchainManager(config: MultiChainConfig): BlockchainManager {
  const manager = new BlockchainManager();

  // Register Ethereum provider if configured
  if (config.ethereum) {
    const ethereumProvider = new EthereumProvider(config.ethereum);
    manager.registerProvider(ethereumProvider);
  }

  // Register Polygon provider if configured
  if (config.polygon) {
    const polygonProvider = new PolygonProvider(config.polygon);
    manager.registerProvider(polygonProvider);
  }

  // Register Stellar provider if configured
  if (config.stellar) {
    const stellarProvider = new StellarProvider(config.stellar);
    manager.registerProvider(stellarProvider);
  }

  return manager;
}

// Default configurations for different environments
export function getDefaultConfigs(environment: NetworkEnvironment): MultiChainConfig {
  const baseConfig = {
    environment,
    timeout: 30000,
    maxRetries: 3
  };

  switch (environment) {
    case NetworkEnvironment.MAINNET:
      return {
        ethereum: {
          ...baseConfig,
          network: BlockchainNetwork.ETHEREUM,
          rpcUrl: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
          chainId: 1,
          blockExplorerUrl: 'https://etherscan.io',
          nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
          }
        } as EthereumConfig,
        polygon: {
          ...baseConfig,
          network: BlockchainNetwork.POLYGON,
          rpcUrl: 'https://polygon-rpc.com',
          chainId: 137,
          blockExplorerUrl: 'https://polygonscan.com',
          nativeCurrency: {
            name: 'Polygon',
            symbol: 'MATIC',
            decimals: 18
          }
        } as PolygonConfig,
        stellar: {
          ...baseConfig,
          network: BlockchainNetwork.STELLAR,
          rpcUrl: 'https://horizon.stellar.org',
          passphrase: 'Public Global Stellar Network ; September 2015',
          blockExplorerUrl: 'https://stellar.expert',
          nativeCurrency: {
            name: 'Stellar',
            symbol: 'XLM',
            decimals: 7
          }
        } as StellarConfig
      };

    case NetworkEnvironment.TESTNET:
      return {
        ethereum: {
          ...baseConfig,
          network: BlockchainNetwork.ETHEREUM,
          rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
          chainId: 11155111,
          blockExplorerUrl: 'https://sepolia.etherscan.io',
          nativeCurrency: {
            name: 'Ethereum Sepolia',
            symbol: 'ETH',
            decimals: 18
          }
        } as EthereumConfig,
        polygon: {
          ...baseConfig,
          network: BlockchainNetwork.POLYGON,
          rpcUrl: 'https://rpc-mumbai.maticvigil.com',
          chainId: 80001,
          blockExplorerUrl: 'https://mumbai.polygonscan.com',
          nativeCurrency: {
            name: 'Polygon Mumbai',
            symbol: 'MATIC',
            decimals: 18
          }
        } as PolygonConfig,
        stellar: {
          ...baseConfig,
          network: BlockchainNetwork.STELLAR,
          rpcUrl: 'https://horizon-testnet.stellar.org',
          passphrase: 'Test SDF Network ; September 2015',
          blockExplorerUrl: 'https://stellar.expert/explorer/testnet',
          nativeCurrency: {
            name: 'Stellar Testnet',
            symbol: 'XLM',
            decimals: 7
          }
        } as StellarConfig
      };

    case NetworkEnvironment.DEVNET:
      return {
        ethereum: {
          ...baseConfig,
          network: BlockchainNetwork.ETHEREUM,
          rpcUrl: 'http://localhost:8545',
          chainId: 31337,
          blockExplorerUrl: 'http://localhost:8545',
          nativeCurrency: {
            name: 'Ethereum Devnet',
            symbol: 'ETH',
            decimals: 18
          }
        } as EthereumConfig,
        polygon: {
          ...baseConfig,
          network: BlockchainNetwork.POLYGON,
          rpcUrl: 'http://localhost:8546',
          chainId: 31338,
          blockExplorerUrl: 'http://localhost:8546',
          nativeCurrency: {
            name: 'Polygon Devnet',
            symbol: 'MATIC',
            decimals: 18
          }
        } as PolygonConfig,
        stellar: {
          ...baseConfig,
          network: BlockchainNetwork.STELLAR,
          rpcUrl: 'http://localhost:8000',
          passphrase: 'Standalone Network ; February 2017',
          blockExplorerUrl: 'http://localhost:8000/explorer',
          nativeCurrency: {
            name: 'Stellar Devnet',
            symbol: 'XLM',
            decimals: 7
          }
        } as StellarConfig
      };

    default:
      return {};
  }
}
