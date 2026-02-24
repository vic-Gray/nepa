#![cfg(test)]

use super::*;
use soroban_sdk::{Env, testutils::{Address as _, Ledger}, String};

#[test]
fn test_registration() {
    let env = Env::default();
    let contract_id = env.register_contract(None, UserManagement);
    let client = UserManagementClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);

    let profile_hash = String::from_str(&env, "ipfs_hash_example_1");
    
    // Register user
    client.register(&user, &profile_hash);

    // Check role
    assert_eq!(client.get_role(&user), UserRole::User);
    
    // Check active
    assert_eq!(client.is_active(&user), true);
    
    // Check reputation
    assert_eq!(client.get_reputation(&user), 0);

    // Check initial verification status
    let profile = client.get_profile(&user);
    assert_eq!(profile.is_verified, false);

    // Admin verifies user
    client.verify_user(&admin, &user);
    let verified_profile = client.get_profile(&user);
    assert_eq!(verified_profile.is_verified, true);
}

#[test]
fn test_rbac_and_suspension() {
    let env = Env::default();
    let contract_id = env.register_contract(None, UserManagement);
    let client = UserManagementClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);
    
    // Register user
    let profile_hash = String::from_str(&env, "hash");
    client.register(&user, &profile_hash);

    // Admin sets role to UtilityProvider
    client.set_role(&admin, &user, &UserRole::UtilityProvider);
    assert_eq!(client.get_role(&user), UserRole::UtilityProvider);
    
    // Admin suspends user
    client.suspend_user(&admin, &user);
    assert_eq!(client.is_active(&user), false);
    
    // Admin unsuspends user
    client.unsuspend_user(&admin, &user);
    assert_eq!(client.is_active(&user), true);
}

#[test]
fn test_activity_tracking() {
    let env = Env::default();
    let contract_id = env.register_contract(None, UserManagement);
    let client = UserManagementClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize(&admin);
    client.register(&user, &String::from_str(&env, "profile"));

    assert_eq!(client.get_activity_count(&user), 0);

    client.log_activity(&user);
    client.log_activity(&user);

    assert_eq!(client.get_activity_count(&user), 2);
}