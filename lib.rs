#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    UserProfile(Address),
    UserRole(Address),
    UserReputation(Address),
    UserStatus(Address),
    UserActivity(Address),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum UserRole {
    None = 0,
    User = 1,
    UtilityProvider = 2,
    Admin = 3,
}

#[contracttype]
#[derive(Clone)]
pub struct UserProfile {
    pub profile_hash: String,
    pub created_at: u64,
    pub is_verified: bool,
}

#[contract]
pub struct UserManagement;

#[contractimpl]
impl UserManagement {
    // Initialize the contract with an admin
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        // Admin also gets the Admin role
        env.storage().persistent().set(&DataKey::UserRole(admin.clone()), &UserRole::Admin);
        env.storage().persistent().set(&DataKey::UserStatus(admin.clone()), &true);
    }

    // Register a new user
    pub fn register(env: Env, user: Address, profile_hash: String) {
        user.require_auth();
        
        if env.storage().persistent().has(&DataKey::UserProfile(user.clone())) {
            panic!("User already registered");
        }

        let profile = UserProfile {
            profile_hash,
            created_at: env.ledger().timestamp(),
            is_verified: false,
        };

        env.storage().persistent().set(&DataKey::UserProfile(user.clone()), &profile);
        // Default role is User
        env.storage().persistent().set(&DataKey::UserRole(user.clone()), &UserRole::User);
        // Default status is Active
        env.storage().persistent().set(&DataKey::UserStatus(user.clone()), &true);
        // Default reputation is 0
        env.storage().persistent().set(&DataKey::UserReputation(user.clone()), &0u32);
        // Initialize activity count
        env.storage().persistent().set(&DataKey::UserActivity(user.clone()), &0u64);
    }

    // Update user profile
    pub fn update_profile(env: Env, user: Address, new_profile_hash: String) {
        user.require_auth();
        Self::check_active(&env, &user);

        let mut profile: UserProfile = env.storage().persistent().get(&DataKey::UserProfile(user.clone())).expect("User not found");
        profile.profile_hash = new_profile_hash;
        
        env.storage().persistent().set(&DataKey::UserProfile(user), &profile);
    }

    // Get user profile
    pub fn get_profile(env: Env, user: Address) -> UserProfile {
        env.storage().persistent().get(&DataKey::UserProfile(user)).expect("User not found")
    }

    // Admin: Verify user
    pub fn verify_user(env: Env, admin: Address, user: Address) {
        admin.require_auth();
        Self::check_admin(&env, &admin);
        
        let mut profile: UserProfile = env.storage().persistent().get(&DataKey::UserProfile(user.clone())).expect("User not found");
        profile.is_verified = true;
        env.storage().persistent().set(&DataKey::UserProfile(user), &profile);
    }

    // Admin: Set user role
    pub fn set_role(env: Env, admin: Address, user: Address, role: UserRole) {
        admin.require_auth();
        Self::check_admin(&env, &admin);
        
        env.storage().persistent().set(&DataKey::UserRole(user), &role);
    }

    // Get user role
    pub fn get_role(env: Env, user: Address) -> UserRole {
        env.storage().persistent().get(&DataKey::UserRole(user)).unwrap_or(UserRole::None)
    }

    // Admin: Set user reputation
    pub fn set_reputation(env: Env, admin: Address, user: Address, score: u32) {
        admin.require_auth();
        Self::check_admin(&env, &admin);
        
        env.storage().persistent().set(&DataKey::UserReputation(user), &score);
    }

    // Get user reputation
    pub fn get_reputation(env: Env, user: Address) -> u32 {
        env.storage().persistent().get(&DataKey::UserReputation(user)).unwrap_or(0)
    }

    // Admin: Suspend user
    pub fn suspend_user(env: Env, admin: Address, user: Address) {
        admin.require_auth();
        Self::check_admin(&env, &admin);
        
        env.storage().persistent().set(&DataKey::UserStatus(user), &false);
    }

    // Admin: Unsuspend user
    pub fn unsuspend_user(env: Env, admin: Address, user: Address) {
        admin.require_auth();
        Self::check_admin(&env, &admin);
        
        env.storage().persistent().set(&DataKey::UserStatus(user), &true);
    }

    // Check if user is active
    pub fn is_active(env: Env, user: Address) -> bool {
        env.storage().persistent().get(&DataKey::UserStatus(user)).unwrap_or(false)
    }

    // Log user activity (increment counter)
    pub fn log_activity(env: Env, user: Address) {
        user.require_auth();
        Self::check_active(&env, &user);

        let count: u64 = env.storage().persistent().get(&DataKey::UserActivity(user.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::UserActivity(user), &(count + 1));
    }

    pub fn get_activity_count(env: Env, user: Address) -> u64 {
        env.storage().persistent().get(&DataKey::UserActivity(user)).unwrap_or(0)
    }

    // Internal checks
    fn check_admin(env: &Env, admin: &Address) {
        // Check if the caller is the contract instance admin
        let instance_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Not initialized");
        if admin == &instance_admin {
            return;
        }
        
        // Or if they have the Admin role
        let role: UserRole = env.storage().persistent().get(&DataKey::UserRole(admin.clone())).unwrap_or(UserRole::None);
        if role != UserRole::Admin {
            panic!("Not authorized: Admin role required");
        }
    }

    fn check_active(env: &Env, user: &Address) {
        let is_active: bool = env.storage().persistent().get(&DataKey::UserStatus(user.clone())).unwrap_or(false);
        if !is_active {
            panic!("User account is not active");
        }
    }
}

#[cfg(test)]
mod test;