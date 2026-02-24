import { TestClient } from '../client/TestClient';
import { TestDataGenerator, TestUser } from '../data/TestDataGenerator';
import { APITestConfig } from '../types/config';

export class UserServiceTester {
  private client: TestClient;
  private dataGenerator: TestDataGenerator;

  constructor(client: TestClient, dataGenerator: TestDataGenerator) {
    this.client = client;
    this.dataGenerator = dataGenerator;
  }

  async testUserRegistration(): Promise<void> {
    console.log('Testing user registration...');

    const userData = {
      email: this.dataGenerator.generateRandomEmail(),
      username: this.dataGenerator.generateRandomString(8),
      name: 'Test User',
      password: 'password123',
      phone: this.dataGenerator.generateRandomPhoneNumber(),
    };

    const result = await this.client.post('/api/auth/register', userData);
    
    if (!result.success) {
      throw new Error(`User registration failed: ${result.error}`);
    }

    console.log('✓ User registration successful');
  }

  async testUserLogin(): Promise<{ user: TestUser; token: string }> {
    console.log('Testing user login...');

    const user = this.dataGenerator.generateUser();
    
    const loginData = {
      email: user.email,
      password: user.password,
    };

    const result = await this.client.post('/api/auth/login', loginData);
    
    if (!result.success) {
      throw new Error(`User login failed: ${result.error}`);
    }

    const token = result.response?.token || result.response?.accessToken;
    if (!token) {
      throw new Error('No token received in login response');
    }

    this.client.setAuthHeader(token);
    console.log('✓ User login successful');

    return { user, token };
  }

  async testUserProfile(): Promise<void> {
    console.log('Testing user profile...');

    const result = await this.client.get('/api/users/profile');
    
    if (!result.success) {
      throw new Error(`Get user profile failed: ${result.error}`);
    }

    console.log('✓ User profile retrieval successful');
  }

  async testUserUpdate(): Promise<void> {
    console.log('Testing user update...');

    const updateData = {
      name: 'Updated Name',
      phone: this.dataGenerator.generateRandomPhoneNumber(),
    };

    const result = await this.client.put('/api/users/profile', updateData);
    
    if (!result.success) {
      throw new Error(`User update failed: ${result.error}`);
    }

    console.log('✓ User update successful');
  }

  async testPasswordChange(): Promise<void> {
    console.log('Testing password change...');

    const newPassword = this.dataGenerator.generateRandomString(12);
    const passwordData = {
      currentPassword: 'password123',
      newPassword: newPassword,
    };

    const result = await this.client.post('/api/users/change-password', passwordData);
    
    if (!result.success) {
      throw new Error(`Password change failed: ${result.error}`);
    }

    console.log('✓ Password change successful');
  }

  async testUserLogout(): Promise<void> {
    console.log('Testing user logout...');

    const result = await this.client.post('/api/auth/logout');
    
    if (!result.success) {
      throw new Error(`User logout failed: ${result.error}`);
    }

    this.client.removeHeader('Authorization');
    console.log('✓ User logout successful');
  }

  async runAllTests(): Promise<void> {
    try {
      await this.testUserRegistration();
      const { user, token } = await this.testUserLogin();
      await this.testUserProfile();
      await this.testUserUpdate();
      await this.testPasswordChange();
      await this.testUserLogout();
      console.log('✓ All user service tests passed');
    } catch (error) {
      console.error('✗ User service tests failed:', error);
      throw error;
    }
  }
}
