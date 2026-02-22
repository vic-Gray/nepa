import { Transaction, TransactionHistory, TransactionFilters, ReceiptData } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class TransactionService {
  private static instance: TransactionService;

  private constructor() {}

  public static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  /**
   * Fetch transaction history with filters
   */
  async getTransactionHistory(filters: TransactionFilters = {}): Promise<TransactionHistory> {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${API_BASE_URL}/transactions/history?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction history: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw error;
    }
  }

  /**
   * Get single transaction details
   */
  async getTransactionById(transactionId: string): Promise<Transaction> {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * Generate receipt for a transaction
   */
  async generateReceipt(transactionId: string): Promise<ReceiptData> {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to generate receipt: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating receipt:', error);
      throw error;
    }
  }

  /**
   * Download receipt as PDF
   */
  async downloadReceiptPDF(transactionId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/receipt/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download receipt: ${response.statusText}`);
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${transactionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      throw error;
    }
  }

  /**
   * Export transactions to CSV
   */
  async exportToCSV(filters: TransactionFilters = {}): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${API_BASE_URL}/transactions/export/csv?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to export transactions: ${response.statusText}`);
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction status updates (real-time)
   */
  async getTransactionStatus(transactionId: string): Promise<Transaction> {
    try {
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get transaction status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw error;
    }
  }

  /**
   * Search transactions by multiple criteria
   */
  async searchTransactions(searchTerm: string, filters: TransactionFilters = {}): Promise<TransactionHistory> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('search', searchTerm);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${API_BASE_URL}/transactions/search?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to search transactions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching transactions:', error);
      throw error;
    }
  }

  /**
   * Get authentication token from localStorage
   */
  private getAuthToken(): string {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return token;
  }

  /**
   * Format currency amount
   */
  static formatAmount(amount: string | number): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(numAmount);
  }

  /**
   * Format date for display
   */
  static formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dateObj);
  }

  /**
   * Get status color for UI
   */
  static getStatusColor(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-100';
      case 'FAILED':
        return 'text-red-600 bg-red-100';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100';
      case 'PROCESSING':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  /**
   * Get status icon
   */
  static getStatusIcon(status: string): string {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return '✅';
      case 'FAILED':
        return '❌';
      case 'PENDING':
        return '⏳';
      case 'PROCESSING':
        return '🔄';
      default:
        return '❓';
    }
  }
}

export default TransactionService.getInstance();
