#[cfg(test)]
mod tests;

mod multi_utility_tests; {
    use super::*;
    use soroban_sdk::{testutils::{Address as TestAddress, Ledger as TestLedger}, Env, Address};

    fn create_test_env() -> Env {
        let env = Env::default();
        env.mock_all_auths();
        env
    }

    fn create_test_address(env: &Env) -> Address {
        Address::from_string(&String::from_str(env, "test_address"))
    }

    fn create_test_oracle_config() -> OracleConfig {
        OracleConfig {
            max_age_seconds: 300, // 5 minutes
            min_reliability_score: 70,
            fallback_enabled: true,
            cost_limit_per_call: 1000000, // 0.001 XLM
        }
    }

    fn create_test_price_feed(env: &Env, feed_address: Address) -> PriceFeed {
        PriceFeed {
            feed_address,
            base_asset: String::from_str(env, "ETH"),
            quote_asset: String::from_str(env, "USD"),
            decimals: 8,
            last_updated: 1640995200, // Jan 1, 2022
            price: 300000000000, // $3000 with 8 decimals
            reliability_score: 85,
        }
    }

    fn create_test_utility_rate(env: &Env) -> UtilityRate {
        UtilityRate {
            utility_type: String::from_str(env, "electricity"),
            rate_per_kwh: 120000, // $0.12 with 6 decimals
            currency: String::from_str(env, "USD"),
            region: String::from_str(env, "LAGOS"),
            last_updated: 1640995200,
            reliability_score: 90,
        }
    }

    #[test]
    fn test_oracle_initialization() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();

        OracleManager::initialize_oracle(env.clone(), admin.clone(), config.clone());

        // Verify config was stored
        let stored_config: OracleConfig = env.storage()
            .instance()
            .get(&symbol_short!("OR_CONF"))
            .unwrap();
        
        assert_eq!(stored_config.max_age_seconds, config.max_age_seconds);
        assert_eq!(stored_config.min_reliability_score, config.min_reliability_score);
        assert_eq!(stored_config.fallback_enabled, config.fallback_enabled);
        assert_eq!(stored_config.cost_limit_per_call, config.cost_limit_per_call);
    }

    #[test]
    fn test_add_and_get_price_feed() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();
        let feed_address = create_test_address(&env);
        let price_feed = create_test_price_feed(&env, feed_address);
        let feed_id = String::from_str(&env, "ETH_USD");

        // Initialize oracle
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);

        // Add price feed
        OracleManager::add_price_feed(env.clone(), admin.clone(), feed_id.clone(), price_feed.clone());

        // Get price feed
        let retrieved_feed = OracleManager::get_price_feed(env.clone(), feed_id.clone()).unwrap();

        assert_eq!(retrieved_feed.base_asset, price_feed.base_asset);
        assert_eq!(retrieved_feed.quote_asset, price_feed.quote_asset);
        assert_eq!(retrieved_feed.price, price_feed.price);
        assert_eq!(retrieved_feed.decimals, price_feed.decimals);
    }

    #[test]
    fn test_update_price_feed() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();
        let feed_address = create_test_address(&env);
        let price_feed = create_test_price_feed(&env, feed_address);
        let feed_id = String::from_str(&env, "ETH_USD");

        // Initialize oracle and add feed
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);
        OracleManager::add_price_feed(env.clone(), admin.clone(), feed_id.clone(), price_feed);

        // Update price feed
        let new_price = 350000000000; // $3500
        let new_timestamp = 1640995300;
        let result = OracleManager::update_price_feed(env.clone(), feed_id.clone(), new_price, new_timestamp);
        assert!(result.is_ok());

        // Verify update
        let updated_feed = OracleManager::get_price_feed(env.clone(), feed_id).unwrap();
        assert_eq!(updated_feed.price, new_price);
        assert_eq!(updated_feed.last_updated, new_timestamp);
    }

    #[test]
    fn test_price_feed_data_too_old() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();
        let feed_address = create_test_address(&env);
        let price_feed = create_test_price_feed(&env, feed_address);
        let feed_id = String::from_str(&env, "ETH_USD");

        // Initialize oracle and add feed
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);
        OracleManager::add_price_feed(env.clone(), admin.clone(), feed_id.clone(), price_feed);

        // Try to update with very old timestamp
        let old_timestamp = 1640995200 - 1000; // 1000 seconds ago
        let result = OracleManager::update_price_feed(env.clone(), feed_id, 300000000000, old_timestamp);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Data too old");
    }

    #[test]
    fn test_add_and_get_utility_rate() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();
        let utility_rate = create_test_utility_rate(&env);
        let rate_id = String::from_str(&env, "electricity_LAGOS");

        // Initialize oracle
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);

        // Add utility rate
        OracleManager::add_utility_rate(env.clone(), admin.clone(), rate_id.clone(), utility_rate.clone());

        // Get utility rate
        let retrieved_rate = OracleManager::get_utility_rate(env.clone(), rate_id.clone()).unwrap();

        assert_eq!(retrieved_rate.utility_type, utility_rate.utility_type);
        assert_eq!(retrieved_rate.rate_per_kwh, utility_rate.rate_per_kwh);
        assert_eq!(retrieved_rate.currency, utility_rate.currency);
        assert_eq!(retrieved_rate.region, utility_rate.region);
    }

    #[test]
    fn test_update_utility_rate() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();
        let utility_rate = create_test_utility_rate(&env);
        let rate_id = String::from_str(&env, "electricity_LAGOS");

        // Initialize oracle and add rate
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);
        OracleManager::add_utility_rate(env.clone(), admin.clone(), rate_id.clone(), utility_rate);

        // Update utility rate
        let new_rate = 150000; // $0.15 with 6 decimals
        let new_timestamp = 1640995300;
        let result = OracleManager::update_utility_rate(env.clone(), rate_id.clone(), new_rate, new_timestamp);
        assert!(result.is_ok());

        // Verify update
        let updated_rate = OracleManager::get_utility_rate(env.clone(), rate_id).unwrap();
        assert_eq!(updated_rate.rate_per_kwh, new_rate);
        assert_eq!(updated_rate.last_updated, new_timestamp);
    }

    #[test]
    fn test_external_data_validation() {
        let env = create_test_env();

        // Test valid data
        assert!(OracleManager::validate_external_data(
            env.clone(),
            300000000000, // $3000
            10000000000,  // $100 min
            1000000000000, // $10000 max
            8
        ));

        // Test data too low
        assert!(!OracleManager::validate_external_data(
            env.clone(),
            5000000000, // $50
            10000000000,  // $100 min
            1000000000000, // $10000 max
            8
        ));

        // Test data too high
        assert!(!OracleManager::validate_external_data(
            env.clone(),
            2000000000000, // $20000
            10000000000,   // $100 min
            1000000000000, // $10000 max
            8
        ));

        // Test decimal precision
        assert!(OracleManager::validate_external_data(
            env.clone(),
            300000000123, // Some fractional part
            10000000000,  // $100 min
            1000000000000, // $10000 max
            8
        ));
    }

    #[test]
    fn test_fallback_price() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = OracleConfig {
            max_age_seconds: 300,
            min_reliability_score: 70,
            fallback_enabled: true,
            cost_limit_per_call: 1000000,
        };
        let feed_address = create_test_address(&env);
        let price_feed = create_test_price_feed(&env, feed_address);
        let feed_id = String::from_str(&env, "ETH_USD");

        // Initialize oracle and add feed
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);
        OracleManager::add_price_feed(env.clone(), admin.clone(), feed_id.clone(), price_feed);

        // Test fallback with recent data
        let fallback_price = OracleManager::get_fallback_price(env.clone(), feed_id.clone());
        assert!(fallback_price.is_some());
        assert_eq!(fallback_price.unwrap(), 300000000000);

        // Test fallback with old data (should return None)
        let old_feed = PriceFeed {
            feed_address,
            base_asset: String::from_str(&env, "BTC"),
            quote_asset: String::from_str(&env, "USD"),
            decimals: 8,
            last_updated: 1640995200 - 1000, // Very old
            price: 50000000000,
            reliability_score: 85,
        };
        let old_feed_id = String::from_str(&env, "BTC_USD");
        OracleManager::add_price_feed(env.clone(), admin.clone(), old_feed_id.clone(), old_feed);
        
        let old_fallback_price = OracleManager::get_fallback_price(env.clone(), old_feed_id);
        assert!(old_fallback_price.is_none());
    }

    #[test]
    fn test_reliability_scoring() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();

        // Initialize oracle
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);

        // Test initial reliability score
        let initial_score = OracleManager::get_reliability_score(env.clone());
        assert_eq!(initial_score, 50); // Neutral score

        // Simulate successful calls
        for _ in 0..10 {
            OracleManager::update_reliability(env.clone(), true, 1000); // 1 second response
        }

        let good_score = OracleManager::get_reliability_score(env.clone());
        assert!(good_score > 80);

        // Simulate some failures
        for _ in 0..5 {
            OracleManager::update_reliability(env.clone(), false, 5000);
        }

        let mixed_score = OracleManager::get_reliability_score(env.clone());
        assert!(mixed_score < good_score);
        assert!(mixed_score > 40);
    }

    #[test]
    fn test_oracle_cost_tracking() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();

        // Initialize oracle
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);

        // Track costs
        let result = OracleManager::track_oracle_cost(env.clone(), 500000); // 0.0005 XLM
        assert!(result.is_ok());

        // Check cost tracking
        let (cost, _, _) = OracleManager::get_oracle_stats(env.clone());
        assert_eq!(cost.total_spent, 500000);
        assert_eq!(cost.calls_made, 1);
        assert_eq!(cost.average_cost_per_call, 500000);

        // Test cost limit
        let expensive_call = OracleManager::track_oracle_cost(env.clone(), 2000000); // 0.002 XLM
        assert!(expensive_call.is_err());
        assert_eq!(expensive_call.unwrap_err(), "Cost exceeds limit per call");
    }

    #[test]
    fn test_update_scheduling() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let config = create_test_oracle_config();

        // Initialize oracle
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);

        // Initially should need updates
        assert!(OracleManager::should_update_price_feeds(env.clone()));
        assert!(OracleManager::should_update_utility_rates(env.clone()));

        // Mark as updated
        OracleManager::mark_price_feeds_updated(env.clone());
        OracleManager::mark_utility_rates_updated(env.clone());

        // Should not need immediate updates
        assert!(!OracleManager::should_update_price_feeds(env.clone()));
        assert!(!OracleManager::should_update_utility_rates(env.clone()));
    }

    #[test]
    fn test_enhanced_billing_with_oracle() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let user = create_test_address(&env);
        let token_address = create_test_address(&env);
        let config = create_test_oracle_config();
        let feed_address = create_test_address(&env);
        let price_feed = create_test_price_feed(&env, feed_address);
        let feed_id = String::from_str(&env, "NGN_USD");

        // Initialize oracle and add exchange rate
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);
        OracleManager::add_price_feed(env.clone(), admin.clone(), feed_id, price_feed);

        // Test enhanced billing with exchange rate conversion
        let result = NepaBillingContract::pay_bill_with_oracle(
            env.clone(),
            user.clone(),
            token_address,
            String::from_str(&env, "meter123"),
            100000000, // 100 NGN
            String::from_str(&env, "NGN"),
            true
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_utility_billing() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let user = create_test_address(&env);
        let token_address = create_test_address(&env);
        let config = create_test_oracle_config();
        let utility_rate = create_test_utility_rate(&env);
        let rate_id = String::from_str(&env, "electricity_LAGOS");

        // Initialize oracle and add utility rate
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);
        OracleManager::add_utility_rate(env.clone(), admin.clone(), rate_id, utility_rate);

        // Test utility billing
        let result = NepaBillingContract::pay_utility_bill(
            env.clone(),
            user.clone(),
            token_address,
            String::from_str(&env, "meter456"),
            50000, // 50 kWh
            String::from_str(&env, "electricity"),
            String::from_str(&env, "LAGOS"),
            String::from_str(&env, "USD")
        );

        assert!(result.is_ok());

        // Check billing details
        let details = NepaBillingContract::get_billing_details(
            env.clone(),
            String::from_str(&env, "meter456"),
            env.ledger().timestamp()
        );
        assert!(details.is_some());
        
        let (kwh, rate, amount, utility_type) = details.unwrap();
        assert_eq!(kwh, 50000);
        assert_eq!(rate, 120000);
        assert_eq!(utility_type, String::from_str(&env, "electricity"));
    }

    #[test]
    fn test_oracle_reliability_validation() {
        let env = create_test_env();
        let admin = create_test_address(&env);
        let user = create_test_address(&env);
        let token_address = create_test_address(&env);
        
        // Initialize with high reliability requirement
        let config = OracleConfig {
            max_age_seconds: 300,
            min_reliability_score: 95, // Very high requirement
            fallback_enabled: true,
            cost_limit_per_call: 1000000,
        };
        OracleManager::initialize_oracle(env.clone(), admin.clone(), config);

        // Try to pay with oracle when no reliable data exists
        let result = NepaBillingContract::pay_bill_with_oracle(
            env.clone(),
            user.clone(),
            token_address,
            String::from_str(&env, "meter789"),
            100000000,
            String::from_str(&env, "NGN"),
            true
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Exchange rate not available");
    }
}
