# NEPA Smart Contract Upgrade System Guide

## Overview

The NEPA billing contract now includes a comprehensive upgrade mechanism that allows for seamless contract upgrades without losing existing payment records or disrupting service. This system implements a proxy pattern with version management and data migration capabilities.

## Architecture

### Components

1. **Upgrade Proxy** (`upgrade_proxy.rs`)
   - Manages contract upgrades and delegation
   - Stores current implementation address and version
   - Controls admin access for upgrade operations

2. **Version Manager** (`version_manager.rs`)
   - Tracks all contract versions
   - Validates upgrade safety
   - Maintains version registry with metadata

3. **Data Migration** (`data_migration.rs`)
   - Handles data backup and restoration
   - Executes migration scripts between versions
   - Ensures data integrity during upgrades

4. **Migration Scripts** (`scripts/`)
   - `migrate_contract.js` - Handles complete migration process
   - `deploy_upgrade.js` - Deploys and registers new versions

## Security Features

### Access Control
- Only authorized admin addresses can initiate upgrades
- Multi-step verification process for all upgrade operations
- Immutable audit trail through event logging

### Data Safety
- Automatic data backup before any upgrade
- Migration validation and rollback capabilities
- Version compatibility checks before upgrade execution

### Upgrade Safety
- Backward compatibility verification
- Migration requirement validation
- Atomic upgrade operations with failure handling

## Usage Guide

### Prerequisites

1. Set up environment variables:
   ```bash
   STELLAR_SECRET_KEY=your_admin_secret_key
   STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
   VERSION_MANAGER_ADDRESS=your_version_manager_address
   ```

2. Install dependencies:
   ```bash
   npm install @stellar/stellar-sdk dotenv
   ```

### Deploying New Versions

#### 1. Build the Contract
```bash
cd nepa-dapp/nepa_contract
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/nepa_contract.wasm .
```

#### 2. Deploy New Version
```bash
node scripts/deploy_upgrade.js deploy \
  nepa-dapp/nepa_contract/nepa_contract.wasm \
  2 \
  --migration-required \
  --backward-compatible
```

#### 3. List Available Versions
```bash
node scripts/deploy_upgrade.js list
```

### Upgrading Existing Contracts

#### 1. Check Upgrade Availability
```bash
node scripts/deploy_upgrade.js check <current_contract_address>
```

#### 2. Perform Migration
```bash
node scripts/migrate_contract.js \
  <old_contract_address> \
  <new_implementation_address> \
  <new_version>
```

## Contract API

### Upgrade Management Functions

#### `initialize_upgrade_system(admin: Address)`
Initializes all upgrade-related systems with the specified admin address.

#### `upgrade_contract(admin: Address, new_implementation: Address, new_version: u32) -> Result<(), Symbol>`
Upgrades the contract to a new version with safety checks and data migration.

#### `register_contract_version(admin: Address, version: u32, implementation_address: Address, migration_required: bool, backward_compatible: bool) -> Result<(), Symbol>`
Registers a new contract version in the version manager.

#### `get_contract_version() -> u32`
Returns the current contract version.

#### `get_upgrade_info() -> (u32, Address, bool)`
Returns current version, implementation address, and admin status.

#### `is_upgrade_available() -> bool`
Checks if a newer version is available for upgrade.

#### `get_migration_status() -> (bool, Option<u32>)`
Returns migration requirement status and current version.

## Migration Process

### Step 1: Pre-Upgrade Checks
1. Verify admin authorization
2. Check upgrade safety and compatibility
3. Validate migration requirements
4. Create data backup

### Step 2: Upgrade Execution
1. Update implementation address
2. Increment version number
3. Emit upgrade events
4. Execute migration scripts if required

### Step 3: Post-Upgrade Verification
1. Verify data integrity
2. Test contract functionality
3. Validate version information
4. Clean up temporary data

## Data Migration

### Migration Types

#### **Schema Migration**
- Changes to data structures
- New fields or modified formats
- Requires data transformation

#### **Configuration Migration**
- Updates to contract settings
- New configuration parameters
- Default value assignments

#### **Data Migration**
- Transfer of existing payment records
- Utility provider information
- Oracle data and rates

### Migration Scripts

Migration scripts are identified by their hash and registered with the version manager:

```rust
DataMigration::register_migration_script(
    env,
    admin,
    from_version,
    to_version,
    script_hash,
    description,
)?;
```

## Version Management

### Version Numbering
- Semantic versioning: `MAJOR.MINOR.PATCH`
- Breaking changes increment MAJOR
- New features increment MINOR
- Bug fixes increment PATCH

### Version Metadata
Each version tracks:
- Implementation address
- Deployment timestamp
- Migration requirements
- Backward compatibility status

### Upgrade Paths
The system validates upgrade paths to ensure:
- No downgrades are allowed
- Breaking changes require explicit migration
- Backward compatibility is maintained where possible

## Testing

### Unit Tests
```bash
cd nepa-dapp/nepa_contract
cargo test
```

### Integration Tests
```bash
npm run test:integration
```

### Upgrade Testing
```bash
npm run test:upgrade
```

## Best Practices

### Development
1. Always test migrations on testnet first
2. Create comprehensive backup strategies
3. Document all breaking changes
4. Use semantic versioning consistently

### Deployment
1. Verify all prerequisites before upgrade
2. Monitor upgrade progress closely
3. Have rollback procedures ready
4. Test thoroughly after upgrade

### Security
1. Use multi-signature admin accounts
2. Implement time delays for critical upgrades
3. Monitor upgrade events for anomalies
4. Regular security audits of upgrade code

## Troubleshooting

### Common Issues

#### **Upgrade Fails**
- Check admin permissions
- Verify version compatibility
- Ensure sufficient gas/stroops
- Review error logs

#### **Migration Issues**
- Verify backup integrity
- Check migration script validity
- Ensure data format compatibility
- Review migration logs

#### **Version Conflicts**
- Clear version registry if corrupted
- Re-register versions manually
- Verify implementation addresses
- Check version numbering

### Recovery Procedures

#### **Data Restoration**
```bash
# Restore from backup
node scripts/migrate_contract.js restore <backup_file>
```

#### **Rollback**
```bash
# Rollback to previous version
node scripts/migrate_contract.js rollback <previous_version>
```

## Monitoring and Logging

### Events
The system emits events for:
- Version registration
- Contract upgrades
- Data migrations
- Backup operations

### Logs
Monitor for:
- Upgrade start/completion
- Migration progress
- Error conditions
- Performance metrics

## Future Enhancements

### Planned Features
1. **Automatic Upgrades** - Scheduled upgrade execution
2. **Multi-Contract Upgrades** - Coordinated upgrades across multiple contracts
3. **Upgrade Templates** - Pre-defined upgrade patterns
4. **Enhanced Monitoring** - Real-time upgrade status dashboard

### Integration Points
1. **External Oracles** - Price feed data migration
2. **Payment Processors** - Payment record continuity
3. **Analytics Systems** - Historical data preservation
4. **Compliance Tools** - Audit trail maintenance

## Support

For issues or questions regarding the upgrade system:
1. Check this documentation first
2. Review test cases for examples
3. Monitor events and logs for debugging
4. Contact the development team for complex issues

---

**Note**: This upgrade system is designed for the Soroban/Stellar blockchain. Ensure you have the correct network configuration and sufficient permissions before performing any upgrade operations.
