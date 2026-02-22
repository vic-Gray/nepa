const { Keypair, Contract } = require('@stellar/stellar-sdk');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Contract Deployment and Upgrade Script
 * 
 * This script handles the deployment of new contract versions and registration
 * in the version management system.
 */

class ContractDeployer {
    constructor(rpcUrl, adminSecret) {
        this.adminKeypair = Keypair.fromSecret(adminSecret);
        this.adminPublicKey = this.adminKeypair.publicKey();
        this.rpcUrl = rpcUrl;
        this.server = new Contract(rpcUrl);
    }

    /**
     * Deploy new contract version
     */
    async deployContract(wasmFile, version, migrationRequired = false, backwardCompatible = true) {
        console.log(`🚀 Deploying contract version ${version}...`);
        
        try {
            // Load WASM file
            const fs = require('fs');
            const wasmBuffer = fs.readFileSync(wasmFile);
            
            // Deploy contract
            const contract = new Contract(wasmBuffer);
            const deployTx = await contract.deploy({
                admin: this.adminPublicKey
            });

            // Sign and submit transaction
            const signedTx = await this.signTransaction(deployTx);
            const result = await this.server.sendTransaction(signedTx);
            
            const contractAddress = result.contract_id;
            
            console.log(`✅ Contract deployed at: ${contractAddress}`);
            
            // Register version
            await this.registerVersion(
                contractAddress,
                version,
                migrationRequired,
                backwardCompatible
            );
            
            return {
                contractAddress,
                version,
                migrationRequired,
                backwardCompatible
            };
        } catch (error) {
            console.error('❌ Deployment failed:', error);
            throw error;
        }
    }

    /**
     * Register new contract version
     */
    async registerVersion(contractAddress, version, migrationRequired, backwardCompatible) {
        console.log(`📝 Registering version ${version}...`);
        
        try {
            const versionManagerContract = new Contract(process.env.VERSION_MANAGER_ADDRESS);
            
            const registerTx = await versionManagerContract.register_contract_version({
                admin: this.adminPublicKey,
                version,
                implementation_address: contractAddress,
                migration_required: migrationRequired,
                backward_compatible: backwardCompatible
            });

            const signedTx = await this.signTransaction(registerTx);
            const result = await this.server.sendTransaction(signedTx);
            
            console.log(`✅ Version ${version} registered successfully`);
            return result;
        } catch (error) {
            console.error('❌ Version registration failed:', error);
            throw error;
        }
    }

    /**
     * Get latest available version
     */
    async getLatestVersion() {
        try {
            const versionManagerContract = new Contract(process.env.VERSION_MANAGER_ADDRESS);
            const latestVersion = await versionManagerContract.get_latest_version();
            return latestVersion;
        } catch (error) {
            console.error('❌ Failed to get latest version:', error);
            throw error;
        }
    }

    /**
     * List all available versions
     */
    async listVersions() {
        try {
            const versionManagerContract = new Contract(process.env.VERSION_MANAGER_ADDRESS);
            const versions = await versionManagerContract.list_contract_versions();
            return versions;
        } catch (error) {
            console.error('❌ Failed to list versions:', error);
            throw error;
        }
    }

    /**
     * Check upgrade availability
     */
    async checkUpgradeAvailability(contractAddress) {
        try {
            const contract = new Contract(contractAddress);
            const isAvailable = await contract.is_upgrade_available();
            const currentVersion = await contract.get_contract_version();
            const latestVersion = await this.getLatestVersion();
            
            return {
                upgradeAvailable: isAvailable,
                currentVersion,
                latestVersion
            };
        } catch (error) {
            console.error('❌ Failed to check upgrade availability:', error);
            throw error;
        }
    }

    /**
     * Build contract from source
     */
    async buildContract(sourcePath) {
        console.log('🔨 Building contract from source...');
        
        try {
            const { execSync } = require('child_process');
            
            // Build Rust contract
            execSync('cargo build --release --target wasm32-unknown-unknown', {
                cwd: sourcePath,
                stdio: 'inherit'
            });
            
            // Copy WASM file
            execSync('cp target/wasm32-unknown-unknown/release/nepa_contract.wasm .', {
                cwd: sourcePath,
                stdio: 'inherit'
            });
            
            console.log('✅ Contract built successfully');
            return `${sourcePath}/nepa_contract.wasm`;
        } catch (error) {
            console.error('❌ Build failed:', error);
            throw error;
        }
    }

    /**
     * Deploy and register complete upgrade
     */
    async deployUpgrade(sourcePath, version, options = {}) {
        const {
            migrationRequired = false,
            backwardCompatible = true,
            build = true
        } = options;
        
        console.log(`🚀 Starting deployment for version ${version}...`);
        
        try {
            // Build contract if requested
            let wasmFile = sourcePath;
            if (build) {
                wasmFile = await this.buildContract(sourcePath);
            }
            
            // Deploy contract
            const deployment = await this.deployContract(
                wasmFile,
                version,
                migrationRequired,
                backwardCompatible
            );
            
            console.log('🎉 Deployment completed successfully');
            return deployment;
        } catch (error) {
            console.error('💥 Deployment failed:', error);
            throw error;
        }
    }

    // Helper methods
    async signTransaction(transaction) {
        transaction.sign(this.adminKeypair);
        return transaction.toXDR();
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node deploy_upgrade.js <command> [options]');
        console.log('Commands:');
        console.log('  deploy <sourcePath> <version> [options]');
        console.log('  list');
        console.log('  check <contractAddress>');
        console.log('');
        console.log('Options for deploy:');
        console.log('  --migration-required');
        console.log('  --no-backward-compatible');
        console.log('  --no-build');
        process.exit(1);
    }

    const [command, ...commandArgs] = args;
    
    if (!process.env.STELLAR_SECRET_KEY) {
        console.error('❌ STELLAR_SECRET_KEY environment variable is required');
        process.exit(1);
    }

    const deployer = new ContractDeployer(
        process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443',
        process.env.STELLAR_SECRET_KEY
    );

    switch (command) {
        case 'deploy':
            handleDeploy(deployer, commandArgs);
            break;
        case 'list':
            handleList(deployer);
            break;
        case 'check':
            handleCheck(deployer, commandArgs[0]);
            break;
        default:
            console.error(`❌ Unknown command: ${command}`);
            process.exit(1);
    }
}

async function handleDeploy(deployer, args) {
    if (args.length < 2) {
        console.error('❌ deploy command requires sourcePath and version');
        process.exit(1);
    }

    const [sourcePath, version, ...options] = args;
    
    const deployOptions = {
        migrationRequired: options.includes('--migration-required'),
        backwardCompatible: !options.includes('--no-backward-compatible'),
        build: !options.includes('--no-build')
    };

    deployer.deployUpgrade(sourcePath, parseInt(version), deployOptions)
        .then(result => {
            console.log('🎉 Deployment completed:', result);
        })
        .catch(error => {
            console.error('💥 Deployment failed:', error);
            process.exit(1);
        });
}

async function handleList(deployer) {
    deployer.listVersions()
        .then(versions => {
            console.log('📋 Available versions:');
            versions.forEach((info, version) => {
                console.log(`  v${version}: ${info.implementation_address}`);
                console.log(`    Migration required: ${info.migration_required}`);
                console.log(`    Backward compatible: ${info.backward_compatible}`);
                console.log(`    Deployed: ${new Date(info.deployment_timestamp * 1000).toISOString()}`);
            });
        })
        .catch(error => {
            console.error('💥 Failed to list versions:', error);
            process.exit(1);
        });
}

async function handleCheck(deployer, contractAddress) {
    if (!contractAddress) {
        console.error('❌ check command requires contractAddress');
        process.exit(1);
    }

    deployer.checkUpgradeAvailability(contractAddress)
        .then(result => {
            console.log('🔍 Upgrade status:');
            console.log(`  Upgrade available: ${result.upgradeAvailable}`);
            console.log(`  Current version: ${result.currentVersion}`);
            console.log(`  Latest version: ${result.latestVersion}`);
        })
        .catch(error => {
            console.error('💥 Failed to check upgrade status:', error);
            process.exit(1);
        });
}

module.exports = ContractDeployer;
