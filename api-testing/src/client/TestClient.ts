import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { APITestConfig, TestResult } from '../types/config';

export class TestClient {
  private client: AxiosInstance;
  private config: APITestConfig;

  constructor(config: APITestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
    this.setupAuth();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[${config.method?.toUpperCase()}] ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[${response.status}] ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`[ERROR] ${error.config?.url}: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  private setupAuth(): void {
    if (!this.config.auth) return;

    switch (this.config.auth.type) {
      case 'bearer':
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.config.auth.token}`;
        break;
      case 'basic':
        const basicAuth = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
        this.client.defaults.headers.common['Authorization'] = `Basic ${basicAuth}`;
        break;
      case 'apikey':
        this.client.defaults.headers.common['X-API-Key'] = this.config.auth.apiKey;
        break;
    }
  }

  async get(endpoint: string, config?: AxiosRequestConfig): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get(endpoint, config);
      return {
        success: true,
        duration: Date.now() - startTime,
        response: response.data,
        status: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        status: error.response?.status,
      };
    }
  }

  async post(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.post(endpoint, data, config);
      return {
        success: true,
        duration: Date.now() - startTime,
        response: response.data,
        status: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        status: error.response?.status,
      };
    }
  }

  async put(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.put(endpoint, data, config);
      return {
        success: true,
        duration: Date.now() - startTime,
        response: response.data,
        status: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        status: error.response?.status,
      };
    }
  }

  async delete(endpoint: string, config?: AxiosRequestConfig): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.delete(endpoint, config);
      return {
        success: true,
        duration: Date.now() - startTime,
        response: response.data,
        status: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        status: error.response?.status,
      };
    }
  }

  async patch(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.patch(endpoint, data, config);
      return {
        success: true,
        duration: Date.now() - startTime,
        response: response.data,
        status: response.status,
      };
    } catch (error: any) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
        status: error.response?.status,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.get('/health');
      return result.success && (result.status === 200 || result.status === 200);
    } catch {
      return false;
    }
  }

  setAuthHeader(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  setHeader(key: string, value: string): void {
    this.client.defaults.headers.common[key] = value;
  }

  removeHeader(key: string): void {
    delete this.client.defaults.headers.common[key];
  }
}
