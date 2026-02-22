#![no_std]
// We added 'Address' and 'token' to imports
use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, Env, String, Symbol};

mod oracle;
use oracle::{OracleConfig, OracleManager, PriceFeed, UtilityRate};

mod multi_utility;
use multi_utility::{
    DiscountRate, FeeType, LateFeeConfig, MultiUtilityManager, SeasonalAdjustment, TaxRate,
    TierRate, TimeOfUseRate, UtilityConfig, UtilityFee, UtilityMeter, UtilityProvider, UtilityType,
};

mod upgrade_proxy;
use upgrade_proxy::UpgradeProxy;

mod version_manager;
use version_manager::{VersionManager, ContractVersion};

mod data_migration;
use data_migration::DataMigration;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod upgrade_tests;

#[contract]
pub struct NepaBillingContract;

#[contractimpl]
impl NepaBillingContract {
    // Initialize the contract with oracle support
    pub fn initialize(env: Env, admin: Address, oracle_config: OracleConfig) {
        // Initialize oracle manager
        OracleManager::initialize_oracle(env, admin, oracle_config);
    }

    // Enhanced pay_bill with oracle integration
    pub fn pay_bill_with_oracle(
        env: Env,
        from: Address,
        token_address: Address,
        meter_id: String,
        amount: i128,
        currency: String,
        use_exchange_rate: bool,
    ) -> Result<(), String> {
        // 1. Verify the user authorized this payment
        from.require_auth();

        // 2. Get exchange rate if needed
        let mut final_amount = amount;
        if use_exchange_rate {
            let exchange_rate_id = format!("{}_USD", currency);
            let price_feed = OracleManager::get_price_feed(env.clone(), exchange_rate_id)
                .ok_or("Exchange rate not available")?;

            // Validate price feed reliability
            let config: OracleConfig = env
                .storage()
                .instance()
                .get(&symbol_short!("OR_CONF"))
                .ok_or("Oracle not initialized")?;

            if price_feed.reliability_score < config.min_reliability_score {
                return Err("Price feed reliability too low".to_string());
            }

            // Convert amount using exchange rate (assuming price is in USD)
            final_amount = (amount * price_feed.price) / (10_i128.pow(price_feed.decimals));
        }

        // 3. Initialize the Token client
        let token_client = token::Client::new(&env, &token_address);

        // 4. Move the tokens from the User to the Contract
        token_client.transfer(&from, &env.current_contract_address(), &final_amount);

        // 5. Update the meter record
        let current_total: i128 = env.storage().persistent().get(&meter_id).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&meter_id, &(current_total + final_amount));

        Ok(())
    }

    // Pay utility bill based on consumption and real-time rates
    pub fn pay_utility_bill(
        env: Env,
        from: Address,
        token_address: Address,
        meter_id: String,
        kwh_consumed: i128,
        utility_type: String,
        region: String,
        currency: String,
    ) -> Result<(), String> {
        // 1. Verify authorization
        from.require_auth();

        // 2. Get utility rate
        let rate_id = format!("{}_{}", utility_type, region);
        let utility_rate = OracleManager::get_utility_rate(env.clone(), rate_id)
            .ok_or("Utility rate not available")?;

        // 3. Validate utility rate
        let config: OracleConfig = env
            .storage()
            .instance()
            .get(&symbol_short!("OR_CONF"))
            .ok_or("Oracle not initialized")?;

        if utility_rate.reliability_score < config.min_reliability_score {
            return Err("Utility rate reliability too low".to_string());
        }

        // 4. Calculate bill amount
        let subtotal = kwh_consumed * utility_rate.rate_per_kwh;

        // 5. Apply currency conversion if needed
        let mut final_amount = subtotal;
        if utility_rate.currency != currency {
            let exchange_rate_id = format!("{}_{}", utility_rate.currency, currency);
            let price_feed = OracleManager::get_price_feed(env.clone(), exchange_rate_id)
                .ok_or("Exchange rate not available")?;

            final_amount = (subtotal * price_feed.price) / (10_i128.pow(price_feed.decimals));
        }

        // 6. Process payment
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&from, &env.current_contract_address(), &final_amount);

        // 7. Update meter record with detailed information
        let billing_key = format!("{}_{}", meter_id, env.ledger().timestamp());
        let billing_data = (
            kwh_consumed,
            utility_rate.rate_per_kwh,
            final_amount,
            utility_type,
        );
        env.storage().persistent().set(&billing_key, &billing_data);

        Ok(())
    }

    // Original pay_bill function for backward compatibility
    pub fn pay_bill(
        env: Env,
        from: Address,
        token_address: Address,
        meter_id: String,
        amount: i128,
    ) {
        // 1. Verify the user authorized this payment
        from.require_auth();

        // 2. Initialize the Token client (for XLM or USDC)
        let token_client = token::Client::new(&env, &token_address);

        // 3. Move the tokens from the User to the Contract
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // 4. Update the meter record (using i128 for larger money values)
        let current_total: i128 = env.storage().persistent().get(&meter_id).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&meter_id, &(current_total + amount));
    }

    pub fn get_total_paid(env: Env, meter_id: String) -> i128 {
        env.storage().persistent().get(&meter_id).unwrap_or(0)
    }

    // Get billing details
    pub fn get_billing_details(
        env: Env,
        meter_id: String,
        timestamp: u64,
    ) -> Option<(i128, i128, i128, String)> {
        let billing_key = format!("{}_{}", meter_id, timestamp);
        env.storage().persistent().get(&billing_key)
    }

    // Oracle management functions (delegated to OracleManager)
    pub fn add_price_feed(env: Env, admin: Address, feed_id: String, price_feed: PriceFeed) {
        OracleManager::add_price_feed(env, admin, feed_id, price_feed);
    }

    pub fn update_price_feed(
        env: Env,
        feed_id: String,
        new_price: i128,
        timestamp: u64,
    ) -> Result<(), String> {
        OracleManager::update_price_feed(env, feed_id, new_price, timestamp)
    }

    pub fn get_price_feed(env: Env, feed_id: String) -> Option<PriceFeed> {
        OracleManager::get_price_feed(env, feed_id)
    }

    pub fn add_utility_rate(env: Env, admin: Address, rate_id: String, utility_rate: UtilityRate) {
        OracleManager::add_utility_rate(env, admin, rate_id, utility_rate);
    }

    pub fn update_utility_rate(
        env: Env,
        rate_id: String,
        new_rate: i128,
        timestamp: u64,
    ) -> Result<(), String> {
        OracleManager::update_utility_rate(env, rate_id, new_rate, timestamp)
    }

    pub fn get_utility_rate(env: Env, rate_id: String) -> Option<UtilityRate> {
        OracleManager::get_utility_rate(env, rate_id)
    }

    pub fn get_oracle_stats(env: Env) -> (oracle::OracleCost, oracle::OracleReliability, u8) {
        OracleManager::get_oracle_stats(env)
    }

    pub fn should_update_oracles(env: Env) -> (bool, bool) {
        (
            OracleManager::should_update_price_feeds(env.clone()),
            OracleManager::should_update_utility_rates(env),
        )
    }

    // === MULTI-UTILITY FUNCTIONS ===

    // Initialize multi-utility system
    pub fn initialize_multi_utility(env: Env, admin: Address) {
        MultiUtilityManager::initialize(env, admin);
    }

    // Register utility provider
    pub fn register_utility_provider(
        env: Env,
        admin: Address,
        provider_id: String,
        name: String,
        provider_address: Address,
        utility_type: u8,
        region: String,
        license_number: String,
        contact_info: String,
    ) -> Result<(), String> {
        MultiUtilityManager::register_provider(
            env,
            admin,
            provider_id,
            name,
            provider_address,
            utility_type,
            region,
            license_number,
            contact_info,
        )
    }

    // Add utility configuration
    pub fn add_utility_configuration(
        env: Env,
        admin: Address,
        config_id: String,
        utility_type: u8,
        provider_id: String,
        region: String,
        base_rate: i128,
        currency: String,
        decimals: u32,
        billing_cycle_days: u32,
        grace_period_days: u32,
        minimum_payment: i128,
        maximum_payment: i128,
    ) -> Result<(), String> {
        MultiUtilityManager::add_utility_config(
            env,
            admin,
            config_id,
            utility_type,
            provider_id,
            region,
            base_rate,
            currency,
            decimals,
            billing_cycle_days,
            grace_period_days,
            minimum_payment,
            maximum_payment,
        )
    }

    // Register utility meter
    pub fn register_utility_meter(
        env: Env,
        provider_address: Address,
        meter_id: String,
        utility_type: u8,
        provider_id: String,
        customer_address: Address,
        location: String,
        meter_model: String,
        firmware_version: String,
        is_smart_meter: bool,
    ) -> Result<(), String> {
        MultiUtilityManager::register_meter(
            env,
            provider_address,
            meter_id,
            utility_type,
            provider_id,
            customer_address,
            location,
            meter_model,
            firmware_version,
            is_smart_meter,
        )
    }

    // Add utility fee
    pub fn add_utility_fee_structure(
        env: Env,
        admin: Address,
        fee_id: String,
        utility_type: u8,
        provider_id: String,
        fee_type: u8,
        fee_amount: i128,
        fee_percentage: Option<i128>,
        is_percentage: bool,
        description: String,
    ) -> Result<(), String> {
        MultiUtilityManager::add_utility_fee(
            env,
            admin,
            fee_id,
            utility_type,
            provider_id,
            fee_type,
            fee_amount,
            fee_percentage,
            is_percentage,
            description,
        )
    }

    // Enhanced multi-utility payment function
    pub fn pay_multi_utility_bill(
        env: Env,
        from: Address,
        token_address: Address,
        meter_id: String,
        consumption: i128,
        currency: String,
        apply_fees: bool,
    ) -> Result<(), String> {
        // 1. Verify authorization
        from.require_auth();

        // 2. Get meter information
        let meter = MultiUtilityManager::get_meter(env.clone(), meter_id.clone())
            .ok_or("Meter not found")?;

        if !meter.is_active {
            return Err("Meter is not active".to_string());
        }

        // 3. Get utility configuration
        let config_id = format!("{}_{}", meter.provider_id, meter.region);
        let config = MultiUtilityManager::get_utility_config(env.clone(), config_id)
            .ok_or("Utility configuration not found")?;

        if !config.is_active {
            return Err("Utility configuration is not active".to_string());
        }

        // 4. Calculate base amount
        let mut base_amount = consumption * config.base_rate;

        // 5. Apply tier rates if applicable
        for tier_rate in config.tier_rates.iter() {
            if consumption >= tier_rate.min_units && consumption <= tier_rate.max_units {
                base_amount = consumption * tier_rate.rate_per_unit;
                break;
            }
        }

        // 6. Apply time-of-use rates if applicable
        let current_hour = (env.ledger().timestamp() / 3600) % 24;
        let current_day_of_week = ((env.ledger().timestamp() / 86400) % 7) as u8;

        for tou_rate in config.time_of_use_rates.iter() {
            if current_hour >= tou_rate.start_hour
                && current_hour <= tou_rate.end_hour
                && tou_rate.days_of_week.contains(current_day_of_week)
            {
                base_amount = (base_amount * tou_rate.rate_multiplier) / 100;
                break;
            }
        }

        // 7. Apply taxes
        let mut tax_amount = 0i128;
        for tax in config.tax_rates.iter() {
            let tax_calc = (base_amount * tax.rate_percentage) / 100;
            tax_amount += tax_calc;
        }

        // 8. Apply fees if requested
        let mut fee_amount = 0i128;
        if apply_fees {
            let fees_key = format!("{}_{}", meter.provider_id, meter.utility_type.to_u8());
            // In a real implementation, we'd query fees by provider and utility type
            // For now, we'll use a default processing fee
            fee_amount = 1000000; // 0.001 XLM default processing fee
        }

        // 9. Calculate final amount
        let subtotal = base_amount + tax_amount + fee_amount;

        // 10. Apply currency conversion if needed
        let mut final_amount = subtotal;
        if config.currency != currency {
            let exchange_rate_id = format!("{}_{}", config.currency, currency);
            let price_feed = OracleManager::get_price_feed(env.clone(), exchange_rate_id)
                .ok_or("Exchange rate not available")?;

            final_amount = (subtotal * price_feed.price) / (10_i128.pow(price_feed.decimals));
        }

        // 11. Validate payment limits
        if final_amount < config.minimum_payment {
            return Err("Amount below minimum payment".to_string());
        }
        if final_amount > config.maximum_payment {
            return Err("Amount exceeds maximum payment".to_string());
        }

        // 12. Process payment
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&from, &env.current_contract_address(), &final_amount);

        // 13. Update meter record with detailed billing information
        let billing_key = format!("{}_{}", meter_id, env.ledger().timestamp());
        let billing_data = (
            consumption,
            base_amount,
            tax_amount,
            fee_amount,
            final_amount,
            meter.utility_type.to_u8(),
            config.version,
        );
        env.storage().persistent().set(&billing_key, &billing_data);

        // 14. Update provider transaction count
        let mut providers = env
            .storage()
            .persistent()
            .get::<String, soroban_sdk::Map<String, multi_utility::UtilityProvider>>(
                &multi_utility::UTILITY_PROVIDERS,
            )
            .unwrap_or_else(|| soroban_sdk::Map::new(&env));

        if let Some(mut provider) = providers.get(meter.provider_id.clone()) {
            provider.total_transactions += 1;
            providers.set(meter.provider_id, provider);
            env.storage()
                .persistent()
                .set(&multi_utility::UTILITY_PROVIDERS, &providers);
        }

        Ok(())
    }

    // Get utility provider
    pub fn get_utility_provider(env: Env, provider_id: String) -> Option<UtilityProvider> {
        MultiUtilityManager::get_provider(env, provider_id)
    }

    // Get utility configuration
    pub fn get_utility_configuration(env: Env, config_id: String) -> Option<UtilityConfig> {
        MultiUtilityManager::get_utility_config(env, config_id)
    }

    // Get utility meter
    pub fn get_utility_meter_info(env: Env, meter_id: String) -> Option<UtilityMeter> {
        MultiUtilityManager::get_meter(env, meter_id)
    }

    // Get utility fee
    pub fn get_utility_fee_info(env: Env, fee_id: String) -> Option<UtilityFee> {
        MultiUtilityManager::get_utility_fee(env, fee_id)
    }

    // List providers by type and region
    pub fn list_providers(
        env: Env,
        utility_type: u8,
        region: String,
    ) -> Result<Vec<UtilityProvider>, String> {
        MultiUtilityManager::list_providers_by_type_and_region(env, utility_type, region)
    }

    // Update provider status
    pub fn update_provider_status(
        env: Env,
        admin: Address,
        provider_id: String,
        is_active: bool,
    ) -> Result<(), String> {
        MultiUtilityManager::update_provider_status(env, admin, provider_id, is_active)
    }

    // Upgrade utility configuration
    pub fn upgrade_utility_configuration(
        env: Env,
        admin: Address,
        config_id: String,
        new_config: UtilityConfig,
    ) -> Result<(), String> {
        MultiUtilityManager::upgrade_utility_config(env, admin, config_id, new_config)
    }

    // Validate utility type
    pub fn validate_utility_type(env: Env, utility_type: u8) -> Result<(), String> {
        MultiUtilityManager::validate_utility_type(env, utility_type)
    }

    // Get all utility types
    pub fn get_supported_utility_types(env: Env) -> soroban_sdk::Map<u8, String> {
        MultiUtilityManager::get_utility_types(env)
    }

    // === UPGRADE MANAGEMENT FUNCTIONS ===

    // Initialize upgrade systems
    pub fn initialize_upgrade_system(env: Env, admin: Address) {
        UpgradeProxy::initialize(env.clone(), admin.clone());
        VersionManager::initialize(env.clone(), admin.clone());
        DataMigration::initialize(env, admin);
    }

    // Upgrade contract to new version
    pub fn upgrade_contract(
        env: Env,
        admin: Address,
        new_implementation: Address,
        new_version: u32,
    ) -> Result<(), Symbol> {
        // Check if upgrade is safe
        let current_version = UpgradeProxy::get_version(env.clone());
        let is_safe = VersionManager::is_upgrade_safe(env.clone(), current_version, new_version)?;
        
        if !is_safe {
            return Err(Symbol::short("UNSAFE_UPGRADE"));
        }

        // Backup data before upgrade
        DataMigration::backup_data(env.clone(), admin.clone())?;

        // Execute upgrade
        UpgradeProxy::upgrade(env.clone(), admin.clone(), new_implementation, new_version)?;

        // Execute data migration if needed
        let version_info = VersionManager::get_version_info(env.clone(), new_version);
        if let Some(info) = version_info {
            if info.migration_required {
                DataMigration::execute_migration(env.clone(), admin, current_version, new_version)?;
            }
        }

        Ok(())
    }

    // Register new contract version
    pub fn register_contract_version(
        env: Env,
        admin: Address,
        version: u32,
        implementation_address: Address,
        migration_required: bool,
        backward_compatible: bool,
    ) -> Result<(), Symbol> {
        VersionManager::register_version(
            env,
            admin,
            version,
            implementation_address,
            migration_required,
            backward_compatible,
        )
    }

    // Get current contract version
    pub fn get_contract_version(env: Env) -> u32 {
        UpgradeProxy::get_version(env)
    }

    // Get contract upgrade info
    pub fn get_upgrade_info(env: Env) -> (u32, Address, bool) {
        let version = UpgradeProxy::get_version(env.clone());
        let implementation = UpgradeProxy::get_implementation(env.clone());
        let admin = UpgradeProxy::get_admin(env);
        (version, implementation, admin == env.current_contract_address())
    }

    // List all contract versions
    pub fn list_contract_versions(env: Env) -> soroban_sdk::Map<u32, ContractVersion> {
        VersionManager::list_versions(env)
    }

    // Check if upgrade is available
    pub fn is_upgrade_available(env: Env) -> bool {
        let current_version = UpgradeProxy::get_version(env.clone());
        if let Some(latest_version) = VersionManager::get_latest_version(env) {
            return latest_version > current_version;
        }
        false
    }

    // Get migration status
    pub fn get_migration_status(env: Env) -> (bool, Option<u32>) {
        let current_version = UpgradeProxy::get_version(env.clone());
        let version_info = VersionManager::get_version_info(env, current_version);
        
        match version_info {
            Some(info) => (info.migration_required, Some(info.version)),
            None => (false, None),
        }
    }
}
