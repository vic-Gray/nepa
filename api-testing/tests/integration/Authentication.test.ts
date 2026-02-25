import { ApiClient } from '../../src/client/ApiClient';
import { v4 as uuidv4 } from 'uuid';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

describe('Authentication Integration Tests', () => {
  let apiClient: ApiClient;
  let testUser: any;

  beforeAll(() => {
    apiClient = new ApiClient(USER_SERVICE_URL);
    testUser = {
      email: `test-${uuidv4()}@example.com`,
      password: 'Password123!',
      name: 'Test User'
    };
  });

  it('should register a new user successfully', async () => {
    const response = await apiClient.post('/api/v1/auth/register', testUser);
    
    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data.data).toHaveProperty('id');
    expect(response.data.data.email).toBe(testUser.email);
  });

  it('should login with registered credentials', async () => {
    const response = await apiClient.post('/api/v1/auth/login', {
      email: testUser.email,
      password: testUser.password
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('token');
    
    // Verify token works
    apiClient.setAuthToken(response.data.token);
    const profileResponse = await apiClient.get('/api/v1/auth/me');
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.data.data.email).toBe(testUser.email);
  });

  it('should fail login with incorrect password', async () => {
    const response = await apiClient.post('/api/v1/auth/login', {
      email: testUser.email,
      password: 'WrongPassword123!'
    });

    expect(response.status).toBe(401);
    expect(response.data.success).toBe(false);
  });
});