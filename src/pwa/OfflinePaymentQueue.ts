export interface QueuedPayment {
  id: string;
  data: {
    billId: string;
    amount: number;
    currency: string;
    network: string;
    recipientAddress: string;
    memo?: string;
  };
  timestamp: Date;
  status: 'queued' | 'processing' | 'synced' | 'failed';
  retryCount: number;
  maxRetries: number;
  error?: string;
  syncedAt?: Date;
}

export interface SyncResult {
  success: boolean;
  paymentId: string;
  error?: string;
  serverResponse?: any;
}

export class OfflinePaymentQueue {
  private dbName = 'nepa-offline-payments';
  private version = 1;
  private storeName = 'paymentQueue';
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private isOnline = navigator.onLine;

  constructor() {
    this.initializeDB();
    this.setupEventListeners();
  }

  /**
   * Initialize IndexedDB for offline payment storage
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open payment queue database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Payment queue database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  /**
   * Setup online/offline event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.isOnline = true;
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this.isOnline = false;
    });

    // Listen for service worker messages
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data.type === 'PAYMENT_SYNC_COMPLETE') {
        this.handleSyncResult(event.data.result);
      }
    });
  }

  /**
   * Add payment to queue
   */
  async addPayment(paymentData: any): Promise<string> {
    if (!this.db) {
      await this.initializeDB();
    }

    const queuedPayment: QueuedPayment = {
      id: this.generateId(),
      data: paymentData,
      timestamp: new Date(),
      status: 'queued',
      retryCount: 0,
      maxRetries: 3
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.add(queuedPayment);
      
      request.onsuccess = () => {
        console.log('Payment added to queue:', queuedPayment.id);
        this.notifyPaymentQueued(queuedPayment);
        resolve(queuedPayment.id);
      };

      request.onerror = () => {
        console.error('Failed to add payment to queue:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all queued payments
   */
  async getQueuedPayments(): Promise<QueuedPayment[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const payments = request.result || [];
        resolve(payments.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
      };

      request.onerror = () => {
        console.error('Failed to get queued payments:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<QueuedPayment | null> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(paymentId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error('Failed to get payment:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(paymentId: string, status: QueuedPayment['status'], error?: string): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const getRequest = store.get(paymentId);
      
      getRequest.onsuccess = () => {
        const payment = getRequest.result;
        if (payment) {
          payment.status = status;
          if (error) {
            payment.error = error;
          }
          if (status === 'synced') {
            payment.syncedAt = new Date();
          }

          const updateRequest = store.put(payment);
          
          updateRequest.onsuccess = () => {
            console.log('Payment status updated:', paymentId, status);
            this.notifyPaymentUpdated(payment);
            resolve();
          };

          updateRequest.onerror = () => {
            console.error('Failed to update payment status:', updateRequest.error);
            reject(updateRequest.error);
          };
        } else {
          reject(new Error('Payment not found'));
        }
      };

      getRequest.onerror = () => {
        console.error('Failed to get payment for update:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Remove payment from queue
   */
  async removePayment(paymentId: string): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(paymentId);

      request.onsuccess = () => {
        console.log('Payment removed from queue:', paymentId);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to remove payment:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Sync queued payments with server
   */
  async syncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log('Starting payment queue sync');

    try {
      const queuedPayments = await this.getQueuedPayments();
      const paymentsToSync = queuedPayments.filter(p => 
        p.status === 'queued' && p.retryCount < p.maxRetries
      );

      console.log(`Found ${paymentsToSync.length} payments to sync`);

      for (const payment of paymentsToSync) {
        await this.syncPayment(payment);
        
        // Add delay between syncs to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('Payment queue sync completed');
    } catch (error) {
      console.error('Payment queue sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync individual payment
   */
  private async syncPayment(payment: QueuedPayment): Promise<void> {
    try {
      await this.updatePaymentStatus(payment.id, 'processing');

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Sync': 'true'
        },
        body: JSON.stringify(payment.data)
      });

      if (response.ok) {
        const result = await response.json();
        await this.updatePaymentStatus(payment.id, 'synced');
        this.notifyPaymentSynced(payment, result);
      } else {
        throw new Error(`Server error: ${response.status}`);
      }

    } catch (error) {
      console.error(`Failed to sync payment ${payment.id}:`, error);
      
      payment.retryCount++;
      
      if (payment.retryCount >= payment.maxRetries) {
        await this.updatePaymentStatus(payment.id, 'failed', error.message);
        this.notifyPaymentFailed(payment, error.message);
      } else {
        await this.updatePaymentStatus(payment.id, 'queued');
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    queued: number;
    processing: number;
    synced: number;
    failed: number;
  }> {
    const payments = await this.getQueuedPayments();
    
    const stats = {
      total: payments.length,
      queued: payments.filter(p => p.status === 'queued').length,
      processing: payments.filter(p => p.status === 'processing').length,
      synced: payments.filter(p => p.status === 'synced').length,
      failed: payments.filter(p => p.status === 'failed').length
    };

    return stats;
  }

  /**
   * Clear synced payments
   */
  async clearSyncedPayments(): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          const payment = cursor.value;
          if (payment.status === 'synced' && payment.syncedAt) {
            const deleteRequest = cursor.delete();
            deleteRequest.onsuccess = () => {
              cursor.continue();
            };
          } else {
            cursor.continue();
          }
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.error('Failed to clear synced payments:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retry failed payments
   */
  async retryFailedPayments(): Promise<void> {
    const payments = await this.getQueuedPayments();
    const failedPayments = payments.filter(p => 
      p.status === 'failed' && p.retryCount < p.maxRetries
    );

    for (const payment of failedPayments) {
      await this.updatePaymentStatus(payment.id, 'queued');
    }

    if (failedPayments.length > 0) {
      await this.syncQueue();
    }
  }

  /**
   * Export queue data
   */
  async exportQueue(): Promise<string> {
    const payments = await this.getQueuedPayments();
    return JSON.stringify(payments, null, 2);
  }

  /**
   * Import queue data
   */
  async importQueue(data: string): Promise<void> {
    try {
      const payments = JSON.parse(data) as QueuedPayment[];
      
      for (const payment of payments) {
        await this.addPayment(payment.data);
      }
      
      console.log(`Imported ${payments.length} payments to queue`);
    } catch (error) {
      console.error('Failed to import queue data:', error);
      throw error;
    }
  }

  // Notification methods
  private notifyPaymentQueued(payment: QueuedPayment): void {
    // Send notification to service worker
    navigator.serviceWorker?.controller?.postMessage({
      type: 'PAYMENT_QUEUED',
      payment
    });

    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Payment Queued', {
        body: `Payment of ${payment.data.amount} ${payment.data.currency} queued for sync`,
        icon: '/static/icons/icon-192x192.png',
        tag: `payment-queued-${payment.id}`
      });
    }
  }

  private notifyPaymentUpdated(payment: QueuedPayment): void {
    navigator.serviceWorker?.controller?.postMessage({
      type: 'PAYMENT_UPDATED',
      payment
    });
  }

  private notifyPaymentSynced(payment: QueuedPayment, serverResponse: any): void {
    navigator.serviceWorker?.controller?.postMessage({
      type: 'PAYMENT_SYNCED',
      payment,
      serverResponse
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Payment Synced', {
        body: `Payment of ${payment.data.amount} ${payment.data.currency} has been processed successfully`,
        icon: '/static/icons/icon-192x192.png',
        tag: `payment-synced-${payment.id}`
      });
    }
  }

  private notifyPaymentFailed(payment: QueuedPayment, error: string): void {
    navigator.serviceWorker?.controller?.postMessage({
      type: 'PAYMENT_FAILED',
      payment,
      error
    });

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Payment Failed', {
        body: `Payment failed: ${error}. Please check your payment method.`,
        icon: '/static/icons/icon-192x192.png',
        tag: `payment-failed-${payment.id}`
      });
    }
  }

  private handleSyncResult(result: SyncResult): void {
    console.log('Sync result received:', result);
    
    if (result.success) {
      this.updatePaymentStatus(result.paymentId, 'synced');
    } else {
      this.updatePaymentStatus(result.paymentId, 'failed', result.error);
    }
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Check if service worker is supported
   */
  isServiceWorkerSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Check if IndexedDB is supported
   */
  isIndexedDBSupported(): boolean {
    return 'indexedDB' in window;
  }

  /**
   * Get current online status
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Get sync status
   */
  getSyncStatus(): boolean {
    return this.syncInProgress;
  }
}
