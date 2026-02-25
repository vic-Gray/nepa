export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  vibrate?: number[];
  silent?: boolean;
  requireInteraction?: boolean;
  timestamp?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  paymentUpdates: boolean;
  billReminders: boolean;
  fraudAlerts: boolean;
  systemUpdates: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

export class PushNotificationService {
  private subscription: PushSubscription | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported: boolean;
  private preferences: NotificationPreferences;
  private db: IDBDatabase | null = null;

  constructor() {
    this.isSupported = this.checkSupport();
    this.preferences = this.getDefaultPreferences();
    
    if (this.isSupported) {
      this.initializeService();
    }
  }

  /**
   * Check if push notifications are supported
   */
  private checkSupport(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      'getKey' in PushSubscription.prototype
    );
  }

  /**
   * Initialize the service
   */
  private async initializeService(): Promise<void> {
    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered for push notifications');

      // Initialize IndexedDB for preferences
      await this.initializeDB();
      
      // Load preferences
      await this.loadPreferences();
      
      // Get existing subscription
      await this.loadSubscription();
      
      // Setup message listener
      this.setupMessageListener();
      
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
    }
  }

  /**
   * Initialize IndexedDB for preferences
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('nepa-notifications', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }
        
        if (!db.objectStoreNames.contains('subscriptions')) {
          db.createObjectStore('subscriptions', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Setup message listener for service worker
   */
  private setupMessageListener(): void {
    navigator.serviceWorker?.addEventListener('message', (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'NOTIFICATION_CLICKED':
          this.handleNotificationClick(data);
          break;
        case 'NOTIFICATION_CLOSED':
          this.handleNotificationClosed(data);
          break;
        case 'SUBSCRIPTION_UPDATED':
          this.handleSubscriptionUpdate(data);
          break;
      }
    });
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported || !this.registration) {
      console.warn('Push notifications not supported');
      return null;
    }

    try {
      // Request notification permission first
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return null;
      }

      // Subscribe to push
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await this.getApplicationServerKey(),
      });

      this.subscription = subscription;
      await this.saveSubscription(subscription);
      
      console.log('Push subscription created:', subscription);
      return subscription;

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      await this.subscription.unsubscribe();
      await this.removeSubscription();
      this.subscription = null;
      
      console.log('Unsubscribed from push notifications');
      return true;

    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    }
  }

  /**
   * Get current subscription
   */
  getSubscription(): PushSubscription | null {
    return this.subscription;
  }

  /**
   * Check if subscribed
   */
  isSubscribed(): boolean {
    return this.subscription !== null;
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    return await Notification.requestPermission();
  }

  /**
   * Get current permission status
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported) {
      return 'denied';
    }

    return Notification.permission;
  }

  /**
   * Send notification locally
   */
  async sendLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.isSupported || this.getPermission() !== 'granted') {
      return;
    }

    // Check quiet hours
    if (this.isQuietHours()) {
      console.log('Notification suppressed due to quiet hours');
      return;
    }

    // Check preferences
    if (!this.shouldShowNotification(payload)) {
      return;
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/static/icons/icon-192x192.png',
      badge: payload.badge || '/static/icons/badge.png',
      tag: payload.tag,
      data: payload.data,
      vibrate: payload.vibrate || [100, 50, 100],
      silent: payload.silent || false,
      requireInteraction: payload.requireInteraction || false,
      timestamp: payload.timestamp || Date.now()
    };

    if (payload.actions && payload.actions.length > 0) {
      options.actions = payload.actions;
    }

    if (payload.image) {
      options.image = payload.image;
    }

    const notification = new Notification(payload.title, options);

    // Setup click handler
    if (payload.data?.url) {
      notification.onclick = () => {
        window.open(payload.data.url);
        notification.close();
      };
    }

    // Auto-close after 5 seconds if not interactive
    if (!payload.requireInteraction) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }

  /**
   * Send push notification via service worker
   */
  async sendPushNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      console.error('Service worker not registered');
      return;
    }

    this.registration.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload
    });
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...preferences };
    await this.savePreferences();
  }

  /**
   * Get notification preferences
   */
  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Schedule notification
   */
  async scheduleNotification(
    payload: NotificationPayload,
    delay: number
  ): Promise<string> {
    const notificationId = this.generateId();
    
    setTimeout(async () => {
      await this.sendLocalNotification(payload);
    }, delay);

    return notificationId;
  }

  /**
   * Schedule recurring notification
   */
  scheduleRecurringNotification(
    payload: NotificationPayload,
    interval: number, // milliseconds
    maxOccurrences?: number
  ): string {
    const notificationId = this.generateId();
    let occurrences = 0;

    const intervalId = setInterval(async () => {
      if (maxOccurrences && occurrences >= maxOccurrences) {
        clearInterval(intervalId);
        return;
      }

      await this.sendLocalNotification(payload);
      occurrences++;
    }, interval);

    return notificationId;
  }

  /**
   * Handle notification click
   */
  private handleNotificationClick(data: any): void {
    console.log('Notification clicked:', data);
    
    // Track analytics
    this.trackNotificationEvent('click', data);
    
    // Handle specific actions
    if (data.action) {
      this.handleNotificationAction(data.action, data);
    }
  }

  /**
   * Handle notification close
   */
  private handleNotificationClosed(data: any): void {
    console.log('Notification closed:', data);
    this.trackNotificationEvent('close', data);
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(action: string, data: any): void {
    switch (action) {
      case 'view_payment':
        window.location.href = `/payments/${data.paymentId}`;
        break;
      case 'pay_bill':
        window.location.href = `/bills/${data.billId}/pay`;
        break;
      case 'view_fraud_alert':
        window.location.href = `/fraud/alerts/${data.alertId}`;
        break;
      case 'dismiss':
        // Just dismiss the notification
        break;
      default:
        console.log('Unknown notification action:', action);
    }
  }

  /**
   * Handle subscription update
   */
  private handleSubscriptionUpdate(data: any): void {
    console.log('Subscription updated:', data);
    this.subscription = data.subscription;
  }

  /**
   * Check if currently in quiet hours
   */
  private isQuietHours(): boolean {
    if (!this.preferences.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= this.preferences.quietHours.start && 
           currentTime <= this.preferences.quietHours.end;
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private shouldShowNotification(payload: NotificationPayload): boolean {
    if (!this.preferences.enabled) {
      return false;
    }

    // Check specific notification types
    if (payload.data?.type) {
      switch (payload.data.type) {
        case 'payment_update':
          return this.preferences.paymentUpdates;
        case 'bill_reminder':
          return this.preferences.billReminders;
        case 'fraud_alert':
          return this.preferences.fraudAlerts;
        case 'system_update':
          return this.preferences.systemUpdates;
        default:
          return true;
      }
    }

    return true;
  }

  /**
   * Get application server key for VAPID
   */
  private async getApplicationServerKey(): Promise<Uint8Array> {
    // This should be fetched from your server
    // For now, return a placeholder
    const response = await fetch('/api/push/vapid-public-key');
    const key = await response.text();
    return this.urlBase64ToUint8Array(key);
  }

  /**
   * Convert URL base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Save subscription to IndexedDB
   */
  private async saveSubscription(subscription: PushSubscription): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readwrite');
      const store = transaction.objectStore('subscriptions');

      const subscriptionData = {
        id: 'current',
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.getKey('p256dh'),
          auth: subscription.getKey('auth')
        },
        expirationTime: subscription.expirationTime,
        createdAt: new Date()
      };

      const request = store.put(subscriptionData);
      
      request.onsuccess = () => {
        console.log('Subscription saved to IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to save subscription:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Load subscription from IndexedDB
   */
  private async loadSubscription(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readonly');
      const store = transaction.objectStore('subscriptions');
      const request = store.get('current');

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          // Recreate subscription object
          this.subscription = {
            endpoint: data.endpoint,
            keys: data.keys,
            expirationTime: data.expirationTime,
            getKey: (type: string) => data.keys[type],
            unsubscribe: async () => {
              // This would need the actual subscription object
              console.warn('Cannot unsubscribe from restored subscription');
              return false;
            }
          } as PushSubscription;
        }
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to load subscription:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Remove subscription from IndexedDB
   */
  private async removeSubscription(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['subscriptions'], 'readwrite');
      const store = transaction.objectStore('subscriptions');
      const request = store.delete('current');

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save preferences to IndexedDB
   */
  private async savePreferences(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readwrite');
      const store = transaction.objectStore('preferences');

      const request = store.put({
        key: 'notification_preferences',
        value: this.preferences
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Load preferences from IndexedDB
   */
  private async loadPreferences(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      const request = store.get('notification_preferences');

      request.onsuccess = () => {
        if (request.result) {
          this.preferences = { ...this.getDefaultPreferences(), ...request.result.value };
        }
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      paymentUpdates: true,
      billReminders: true,
      fraudAlerts: true,
      systemUpdates: false,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    };
  }

  /**
   * Track notification events for analytics
   */
  private trackNotificationEvent(event: string, data: any): void {
    // Send analytics data
    fetch('/api/analytics/notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      })
    }).catch(error => {
      console.error('Failed to track notification event:', error);
    });
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Check if push notifications are supported
   */
  isPushSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get subscription info for server
   */
  getSubscriptionInfo(): any {
    if (!this.subscription) {
      return null;
    }

    return {
      endpoint: this.subscription.endpoint,
      keys: {
        p256dh: this.subscription.getKey('p256dh'),
        auth: this.subscription.getKey('auth')
      }
    };
  }
}
