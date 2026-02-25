# Multi-Blockchain Payment Guide

This guide explains how to use the extended NEPA platform that now supports multiple blockchain networks beyond the original Stellar implementation.

## Overview

The NEPA platform now supports:
- **Stellar** - Fast, low-cost payments (original implementation)
- **Ethereum** - Smart contract platform with extensive ecosystem
- **Polygon** - Scalable Ethereum sidechain with lower fees
- **Cross-chain** - Bridge transactions between supported networks

## Architecture

### Abstract Blockchain Interface

The platform uses an abstract `BlockchainProvider` interface that allows for:
- Unified API across different blockchain networks
- Easy addition of new blockchain providers
- Consistent error handling and transaction management
- Network-specific optimizations (gas fees, confirmations, etc.)

### Key Components

1. **BlockchainManager** - Central coordinator for all blockchain operations
2. **MultiChainPaymentService** - High-level payment processing service
3. **CrossChainMonitor** - Monitoring service for cross-chain transactions
4. **NetworkSelector** - UI component for network selection
5. **Database Schema** - Enhanced to support multi-chain data

## Supported Networks

### Stellar
- **Native Currency**: XLM
- **Transaction Fee**: Fixed (0.00001 XLM)
- **Confirmation Time**: ~3-5 seconds
- **Use Case**: Fast, low-cost payments

### Ethereum
- **Native Currency**: ETH
- **Transaction Fee**: Variable (gas-based)
- **Confirmation Time**: ~15-30 seconds
- **Use Case**: Smart contracts, DeFi integration

### Polygon
- **Native Currency**: MATIC
- **Transaction Fee**: Low (gas-based)
- **Confirmation Time**: ~2-5 seconds
- **Use Case**: Cost-effective Ethereum transactions

## Getting Started

### 1. Installation

Make sure you have the required dependencies installed:

```bash
npm install ethers@^6.8.0 web3@^4.2.0 @types/web3@^1.2.2
```

### 2. Configuration

Update your environment variables to include the new blockchain configurations:

```env
# Ethereum Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_TESTNET_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Polygon Configuration
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_TESTNET_RPC_URL=https://rpc-mumbai.maticvigil.com.com

# Stellar Configuration (existing)
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_TESTNET_HORIZON_URL=https://horizon-testnet.stellar.org
```

### 3. Database Migration

Run the database migrations to add the new multi-chain support:

```bash
npm run db:migrate-all
```

## Usage Examples

### Basic Multi-Chain Payment

```typescript
import { MultiChainPaymentService, BlockchainNetwork } from '../src/blockchain';

// Initialize the payment service
const paymentService = new MultiChainPaymentService({
  environment: 'testnet',
  enableCrossChain: true,
  maxGasPrice: '100',
  gasMultiplier: 1.2
});

// Process a payment on Ethereum
const paymentRequest = {
  billId: 'bill-123',
  userId: 'user-123',
  amount: '0.1',
  currency: 'ETH',
  network: BlockchainNetwork.ETHEREUM,
  recipientAddress: '0x1234567890123456789012345678901234567890',
  memo: 'Payment for electricity bill'
};

const result = await paymentService.processPayment(paymentRequest);
console.log('Payment result:', result);
```

### Network Selection UI

```typescript
import { NetworkSelector } from '../src/components/NetworkSelector';
import { useBlockchain } from '../src/hooks/useBlockchain';

function PaymentComponent() {
  const { 
    connect, 
    disconnect, 
    isConnected, 
    currentNetwork, 
    account 
  } = useBlockchain({
    environment: 'testnet',
    autoConnect: false
  });

  const handleNetworkChange = (network: BlockchainNetwork) => {
    console.log('Network changed to:', network);
  };

  const handleConnected = (connection: WalletConnection) => {
    console.log('Connected to:', connection);
  };

  return (
    <div>
      <NetworkSelector
        onNetworkChange={handleNetworkChange}
        onConnected={handleConnected}
        environment="testnet"
      />
      
      {isConnected && (
        <div>
          <p>Connected to {currentNetwork}</p>
          <p>Account: {account}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}
```

### Cross-Chain Transaction

```typescript
// Process a cross-chain payment from Ethereum to Polygon
const crossChainRequest = {
  fromNetwork: BlockchainNetwork.ETHEREUM,
  toNetwork: BlockchainNetwork.POLYGON,
  fromAddress: '0x1234567890123456789012345678901234567890',
  toAddress: '0x0987654321098765432109876543210987654321',
  amount: '1',
  asset: 'ETH',
  slippageTolerance: 1.0 // 1% slippage tolerance
};

const crossChainResult = await paymentService.processCrossChainPayment(crossChainRequest);
console.log('Cross-chain transaction:', crossChainResult);
```

### Transaction Monitoring

```typescript
import { CrossChainMonitor } from '../src/services/CrossChainMonitor';

// Initialize the monitor
const monitor = new CrossChainMonitor(blockchainManager, {
  checkInterval: 30000, // 30 seconds
  maxRetries: 10,
  timeout: 3600000 // 1 hour
});

// Start monitoring a cross-chain transaction
monitor.startMonitoring(crossChainResult);

// Listen for events
monitor.on('completion', (event) => {
  console.log('Cross-chain transaction completed:', event.transaction);
});

monitor.on('failure', (event) => {
  console.log('Cross-chain transaction failed:', event.transaction);
});
```

## Gas Fee Management

### Gas Estimation

```typescript
// Estimate gas for a transaction
const gasEstimate = await paymentService.estimateGas({
  from: '0x1234567890123456789012345678901234567890',
  to: '0x0987654321098765432109876543210987654321',
  amount: '0.1',
  memo: 'Test transaction'
});

console.log('Gas estimate:', gasEstimate);
// Output: { gasLimit: '21000', gasPrice: '20', estimatedCost: '0.00042 ETH' }
```

### Network Fee Information

```typescript
// Get current network fee information
const feeInfo = await paymentService.getNetworkFeeInfo(BlockchainNetwork.ETHEREUM);

console.log('Fee info:', feeInfo);
// Output: {
//   slow: { gasPrice: '10', estimatedTime: 5 },
//   standard: { gasPrice: '20', estimatedTime: 2 },
//   fast: { gasPrice: '30', estimatedTime: 1 },
//   currency: 'ETH'
// }
```

## Wallet Integration

### Supported Wallet Types

- **MetaMask** - Ethereum and Polygon
- **Freighter** - Stellar
- **Private Key** - All networks (for development/testing)

### Wallet Connection

```typescript
// Connect to MetaMask (Ethereum/Polygon)
await blockchainManager.connect(BlockchainNetwork.ETHEREUM);

// Connect to Freighter (Stellar)
await blockchainManager.connect(BlockchainNetwork.STELLAR);
```

## Error Handling

### Common Error Types

```typescript
import { BlockchainErrorImpl } from '../src/blockchain/types';

try {
  await paymentService.processPayment(request);
} catch (error) {
  if (error instanceof BlockchainErrorImpl) {
    console.error('Blockchain error:', error.message);
    console.error('Network:', error.network);
    console.error('Code:', error.code);
    
    // Handle specific error types
    switch (error.code) {
      case 'GAS_PRICE_TOO_HIGH':
        // Show user message about high gas fees
        break;
      case 'INVALID_ADDRESS':
        // Show validation error
        break;
      case 'CONNECTION_FAILED':
        // Retry connection or show network error
        break;
    }
  }
}
```

## Database Schema

### New Models

1. **CrossChainTransaction** - Stores cross-chain transaction data
2. **BlockchainWallet** - Multi-network wallet information
3. **NetworkConfig** - Blockchain network configurations

### Enhanced Payment Model

The `Payment` model now includes:
- `network` - Blockchain network used
- `transactionHash` - Blockchain transaction hash
- `gasUsed` - Gas used (EVM networks)
- `gasPrice` - Gas price (EVM networks)
- `fee` - Network fee
- `asset` - Asset symbol (XLM, ETH, MATIC, etc.)
- `confirmations` - Number of confirmations
- `blockNumber` - Block number when confirmed

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run blockchain-specific tests
npm test tests/unit/blockchain/

# Run with coverage
npm run test:coverage
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run blockchain integration tests
npm test tests/integration/blockchain/
```

## Security Considerations

### Private Key Management

- Never store private keys in plain text
- Use encrypted storage for wallet data
- Implement proper key derivation and encryption

### Transaction Validation

- Validate all addresses before transactions
- Implement proper amount validation
- Use slippage protection for cross-chain transactions

### Network Security

- Use reputable RPC providers
- Implement proper rate limiting
- Monitor for suspicious activity

## Performance Optimization

### Connection Pooling

- Reuse blockchain connections when possible
- Implement connection timeouts
- Use WebSocket connections for real-time updates

### Caching

- Cache balance information
- Cache network fee data
- Cache transaction status for completed transactions

### Batch Operations

- Batch multiple transactions when possible
- Use multicall for Ethereum operations
- Implement efficient polling strategies

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check RPC URL configuration
   - Verify network connectivity
   - Check wallet availability

2. **Gas Estimation Errors**
   - Verify sufficient balance
   - Check gas price limits
   - Validate transaction parameters

3. **Cross-Chain Delays**
   - Monitor bridge provider status
   - Check confirmation requirements
   - Verify slippage settings

### Debug Mode

Enable debug logging for detailed troubleshooting:

```typescript
const paymentService = new MultiChainPaymentService({
  environment: 'testnet',
  debug: true // Enable debug logging
});
```

## Future Enhancements

### Planned Features

1. **Additional Networks**
   - BSC (Binance Smart Chain)
   - Arbitrum
   - Optimism
   - Avalanche

2. **Advanced Bridge Features**
   - Multiple bridge providers
   - Route optimization
   - Liquidity aggregation

3. **Enhanced UI**
   - Real-time fee tracking
   - Transaction progress visualization
   - Advanced wallet management

4. **Security Improvements**
   - Hardware wallet support
   - Multi-signature transactions
   - Advanced fraud detection

## Contributing

When contributing to the multi-blockchain functionality:

1. Follow the existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Ensure backward compatibility
5. Test on all supported networks

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create detailed bug reports
4. Include network and configuration details

---

This guide provides a comprehensive overview of the multi-blockchain functionality. For specific implementation details, refer to the source code and inline documentation.
