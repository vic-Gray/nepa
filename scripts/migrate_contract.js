const { Keypair, Contract } = require('@stellar/stellar-sdk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Contract Migration Script
 * 
 * This script handles the migration of the NEPA billing contract to a new version.
 * It includes data backup, contract upgrade, and data restoration procedures.
 */

class ContractMigrator {
    constructor(rpcUrl, adminSecret) {
        this.adminKeypair = Keypair.fromSecret(adminSecret);
        this.adminPublicKey = this.adminKeypair.publicKey();
        this.rpcUrl = rpcUrl;
        this.server = new Contract(rpcUrl);
    }

    /**
     * Backup current contract data before migration
     */
    async backupContractData(contractAddress) {
        console.log('🔄 Backing up contract data...');
        
        try {
            // Get current contract state
            const contract = new Contract(contractAddress);
            
            // Backup meter data
            const meterKeys = await this.getStorageKeys(contract, 'meter_*');
            const meterData = {};
            
            for (const key of meterKeys) {
                const data = await this.getStorageData(contract, key);
                meterData[key] = data;
            }

            // Backup oracle data
            const oracleKeys = await this.getStorageKeys(contract, 'oracle_*');
            const oracleData = {};
            
            for (const key of oracleKeys) {
                const data = await this.getStorageData(contract, key);
                oracleData[key] = data;
            }

            // Backup utility data
            const utilityKeys = await this.getStorageKeys(contract, 'utility_*');
            const utilityData = {};
            
            for (const key of utilityKeys) {
                const data = await this.getStorageData(contract, key);
                utilityData[key] = data;
            }

            const backup = {
                timestamp: Date.now(),
                contractAddress,
                meterData,
                oracleData,
                utilityData
            };

            // Save backup to file
            const fs = require('fs');
            const backupFile = `backup_${contractAddress}_${Date.now()}.json`;
            fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
            
            console.log(`✅ Backup saved to ${backupFile}`);
            return backupFile;
        } catch (error) {
            console.error('❌ Backup failed:', error);
            throw error;
        }
    }

    /**
     * Upgrade contract to new version
     */
    async upgradeContract(oldContractAddress, newImplementationAddress, newVersion) {
        console.log(`🔄 Upgrading contract to version ${newVersion}...`);
        
        try {
            const contract = new Contract(oldContractAddress);
            
            // Check if upgrade is safe
            const isSafe = await this.isUpgradeSafe(contract, newVersion);
            if (!isSafe) {
                throw new Error('Upgrade is not safe');
            }

            // Execute upgrade
            const upgradeTx = await contract.upgrade_contract({
                admin: this.adminPublicKey,
                new_implementation: newImplementationAddress,
                new_version: newVersion
            });

            // Sign and submit transaction
            const signedTx = await this.signTransaction(upgradeTx);
            const result = await this.server.sendTransaction(signedTx);
            
            console.log('✅ Contract upgraded successfully');
            return result;
        } catch (error) {
            console.error('❌ Upgrade failed:', error);
            throw error;
        }
    }

    /**
     * Migrate data after contract upgrade
     */
    async migrateData(contractAddress, fromVersion, toVersion) {
        console.log(`🔄 Migrating data from v${fromVersion} to v${toVersion}...`);
        
        try {
            const contract = new Contract(contractAddress);
            
            // Execute data migration
            const migrateTx = await contract.execute_migration({
                admin: this.adminPublicKey,
                from_version: fromVersion,
                to_version: toVersion
            });

            // Sign and submit transaction
            const signedTx = await this.signTransaction(migrateTx);
            const result = await this.server.sendTransaction(signedTx);
            
            console.log('✅ Data migration completed');
            return result;
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    /**
     * Verify migration integrity
     */
    async verifyMigration(contractAddress, backupFile) {
        console.log('🔍 Verifying migration integrity...');
        
        try {
            const fs = require('fs');
            const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            const contract = new Contract(contractAddress);

            // Verify meter data
            let meterDataIntact = true;
            for (const [key, expectedData] of Object.entries(backup.meterData)) {
                const currentData = await this.getStorageData(contract, key);
                if (JSON.stringify(currentData) !== JSON.stringify(expectedData)) {
                    meterDataIntact = false;
                    console.warn(`⚠️  Meter data mismatch for key: ${key}`);
                }
            }

            // Verify oracle data
            let oracleDataIntact = true;
            for (const [key, expectedData] of Object.entries(backup.oracleData)) {
                const currentData = await this.getStorageData(contract, key);
                if (JSON.stringify(currentData) !== JSON.stringify(expectedData)) {
                    oracleDataIntact = false;
                    console.warn(`⚠️  Oracle data mismatch for key: ${key}`);
                }
            }

            // Verify utility data
            let utilityDataIntact = true;
            for (const [key, expectedData] of Object.entries(backup.utilityData)) {
                const currentData = await this.getStorageData(contract, key);
                if (JSON.stringify(currentData) !== JSON.stringify(expectedData)) {
                    utilityDataIntact = false;
                    console.warn(`⚠️  Utility data mismatch for key: ${key}`);
                }
            }

            const allDataIntact = meterDataIntact && oracleDataIntact && utilityDataIntact;
            
            if (allDataIntact) {
                console.log('✅ Migration verification passed');
            } else {
                console.warn('⚠️  Migration verification found issues');
            }

            return allDataIntact;
        } catch (error) {
            console.error('❌ Verification failed:', error);
            throw error;
        }
    }

    /**
     * Complete migration process
     */
    async migrate(oldContractAddress, newImplementationAddress, newVersion) {
        console.log(`🚀 Starting contract migration process...`);
        
        try {
            // Step 1: Backup data
            const backupFile = await this.backupContractData(oldContractAddress);
            
            // Step 2: Get current version
            const contract = new Contract(oldContractAddress);
            const currentVersion = await contract.get_contract_version();
            
            // Step 3: Upgrade contract
            await this.upgradeContract(oldContractAddress, newImplementationAddress, newVersion);
            
            // Step 4: Migrate data
            await this.migrateData(oldContractAddress, currentVersion, newVersion);
            
            // Step 5: Verify migration
            const isVerified = await this.verifyMigration(oldContractAddress, backupFile);
            
            console.log('✅ Migration process completed successfully');
            return {
                success: true,
                backupFile,
                verified: isVerified,
                fromVersion: currentVersion,
                toVersion: newVersion
            };
        } catch (error) {
            console.error('❌ Migration process failed:', error);
            throw error;
        }
    }

    // Helper methods
    async signTransaction(transaction) {
        transaction.sign(this.adminKeypair);
        return transaction.toXDR();
    }

    async getStorageKeys(contract, pattern) {
        // Implementation would depend on Soroban SDK methods
        // This is a placeholder for the actual implementation
        return [];
    }

    async getStorageData(contract, key) {
        // Implementation would depend on Soroban SDK methods
        // This is a placeholder for the actual implementation
        return null;
    }

    async isUpgradeSafe(contract, newVersion) {
        try {
            const currentVersion = await contract.get_contract_version();
            return await contract.is_upgrade_safe(currentVersion, newVersion);
        } catch (error) {
            return false;
        }
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.log('Usage: node migrate_contract.js <oldContractAddress> <newImplementationAddress> <newVersion>');
        process.exit(1);
    }

    const [oldContractAddress, newImplementationAddress, newVersion] = args;
    
    if (!process.env.STELLAR_SECRET_KEY) {
        console.error('❌ STELLAR_SECRET_KEY environment variable is required');
        process.exit(1);
    }

    const migrator = new ContractMigrator(
        process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443',
        process.env.STELLAR_SECRET_KEY
    );

    migrator.migrate(oldContractAddress, newImplementationAddress, parseInt(newVersion))
        .then(result => {
            console.log('🎉 Migration completed:', result);
        })
        .catch(error => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = ContractMigrator;
