const CACHE_NAME = 'nepa-pwa-v1';
const OFFLINE_CACHE_NAME = 'nepa-offline-v1';
const DYNAMIC_CACHE_NAME = 'nepa-dynamic-v1';

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Cache configuration
const CACHE_CONFIG = {
  staticAssets: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 100,
    strategy: CACHE_STRATEGIES.CACHE_FIRST
  },
  apiResponses: {
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST
  },
  userBills: {
    maxAge: 10 * 60 * 1000, // 10 minutes
    maxEntries: 20,
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE
  },
  payments: {
    maxAge: 60 * 60 * 1000, // 1 hour
    maxEntries: 100,
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE
  }
};

// URLs to cache on install
const STATIC_CACHE_URLS = [
  '/',
  '/dashboard',
  '/bills',
  '/history',
  '/profile',
  '/offline.html',
  '/manifest.json',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/static/icons/icon-192x192.png',
  '/static/icons/icon-512x512.png'
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  /^\/api\/bills/,
  /^\/api\/payments/,
  /^\/api\/user\/profile/,
  /^\/api\/blockchain\/networks/
];

// Payment queue for offline functionality
let paymentQueue = [];
let isOnline = navigator.onLine;
let syncInProgress = false;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => 
              cacheName !== CACHE_NAME && 
              cacheName !== OFFLINE_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME
            )
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle different request types
  if (request.method === 'GET') {
    if (isStaticAsset(request)) {
      event.respondWith(handleStaticAsset(request));
    } else if (isAPIRequest(request)) {
      event.respondWith(handleAPIRequest(request));
    } else {
      event.respondWith(handleNavigationRequest(request));
    }
  } else if (request.method === 'POST' && isPaymentRequest(request)) {
    event.respondWith(handlePaymentRequest(request));
  } else {
    // For other POST requests, try network first
    event.respondWith(handleNetworkRequest(request));
  }
});

// Handle static assets
async function handleStaticAsset(request) {
  return cacheFirst(request, CACHE_NAME, CACHE_CONFIG.staticAssets);
}

// Handle API requests
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Determine cache config based on endpoint
  let cacheConfig = CACHE_CONFIG.apiResponses;
  if (pathname.startsWith('/api/bills')) {
    cacheConfig = CACHE_CONFIG.userBills;
  } else if (pathname.startsWith('/api/payments')) {
    cacheConfig = CACHE_CONFIG.payments;
  }
  
  // Check if request is cacheable
  const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => 
    pattern.test(pathname)
  );
  
  if (isCacheable) {
    return staleWhileRevalidate(request, DYNAMIC_CACHE_NAME, cacheConfig);
  } else {
    return networkFirst(request, DYNAMIC_CACHE_NAME, cacheConfig);
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful navigation responses
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('Network failed, trying cache:', error);
  }
  
  // Fallback to cache
  return caches.match(request)
    .then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Fallback to offline page
      return caches.match('/offline.html');
    });
}

// Handle payment requests
async function handlePaymentRequest(request) {
  if (!isOnline) {
    // Queue payment for when online
    const paymentData = await request.json();
    const queuedPayment = {
      id: generateId(),
      data: paymentData,
      timestamp: new Date().toISOString(),
      status: 'queued',
      retryCount: 0
    };
    
    paymentQueue.push(queuedPayment);
    await savePaymentQueue();
    
    // Return queued response
    return new Response(JSON.stringify({
      success: true,
      queued: true,
      message: 'Payment queued for when online',
      paymentId: queuedPayment.id
    }), {
      status: 202,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  // If online, process normally
  return handleNetworkRequest(request);
}

// Handle general network requests
async function handleNetworkRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network request failed:', error);
    
    // Try cache for GET requests
    if (request.method === 'GET') {
      return caches.match(request);
    }
    
    throw error;
  }
}

// Cache strategy implementations
async function cacheFirst(request, cacheName, config) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await enforceCacheSize(cache, config.maxEntries);
    }
    
    return networkResponse;
  } catch (error) {
    return cachedResponse || createOfflineResponse();
  }
}

async function networkFirst(request, cacheName, config) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await enforceCacheSize(cache, config.maxEntries);
    }
    
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
      return cachedResponse;
    }
    
    return createOfflineResponse();
  }
}

async function staleWhileRevalidate(request, cacheName, config) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always try to fetch from network
  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);
        await enforceCacheSize(cache, config.maxEntries);
      }
      return networkResponse;
    })
    .catch(() => null);
  
  // Return cached response immediately if available
  if (cachedResponse && !isExpired(cachedResponse, config.maxAge)) {
    // Revalidate in background
    networkPromise.then(() => {
      console.log('Background revalidation completed for:', request.url);
    });
    
    return cachedResponse;
  }
  
  // Wait for network if no cache or expired
  return networkPromise || createOfflineResponse();
}

// Background sync
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered');
  
  if (event.tag === 'payment-sync') {
    event.waitUntil(syncPaymentQueue());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from NEPA',
    icon: '/static/icons/icon-192x192.png',
    badge: '/static/icons/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/dashboard'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/static/icons/view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/static/icons/dismiss.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('NEPA', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/dashboard')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
  } else {
    // Click on notification body
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Online/offline event handling
self.addEventListener('online', () => {
  console.log('Service Worker: Online');
  isOnline = true;
  
  // Trigger payment queue sync when coming back online
  if (paymentQueue.length > 0 && !syncInProgress) {
    syncPaymentQueue();
  }
});

self.addEventListener('offline', () => {
  console.log('Service Worker: Offline');
  isOnline = false;
});

// Payment queue management
async function syncPaymentQueue() {
  if (syncInProgress || paymentQueue.length === 0) {
    return;
  }
  
  syncInProgress = true;
  console.log('Syncing payment queue, items:', paymentQueue.length);
  
  for (const payment of paymentQueue) {
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payment.data)
      });
      
      if (response.ok) {
        // Remove from queue on success
        paymentQueue = paymentQueue.filter(p => p.id !== payment.id);
        
        // Send notification about successful sync
        self.registration.showNotification('Payment Synced', {
          body: `Payment of ${payment.data.amount} ${payment.data.currency} has been processed`,
          icon: '/static/icons/icon-192x192.png',
          tag: `payment-sync-${payment.id}`
        });
      } else {
        payment.retryCount++;
        if (payment.retryCount >= 3) {
          // Remove from queue after 3 failed attempts
          paymentQueue = paymentQueue.filter(p => p.id !== payment.id);
          
          self.registration.showNotification('Payment Failed', {
            body: 'Payment failed after multiple attempts. Please check your payment method.',
            icon: '/static/icons/icon-192x192.png',
            tag: `payment-failed-${payment.id}`
          });
        }
      }
    } catch (error) {
      console.error('Payment sync error:', error);
      payment.retryCount++;
    }
    
    // Save queue state
    await savePaymentQueue();
  }
  
  syncInProgress = false;
  console.log('Payment queue sync completed');
}

async function savePaymentQueue() {
  // Save to IndexedDB for persistence
  const db = await openDB();
  const tx = db.transaction(['paymentQueue'], 'readwrite');
  const store = tx.objectStore('paymentQueue');
  
  // Clear existing queue
  await store.clear();
  
  // Save current queue
  for (const payment of paymentQueue) {
    await store.add(payment);
  }
}

async function loadPaymentQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(['paymentQueue'], 'readonly');
    const store = tx.objectStore('paymentQueue');
    const payments = await store.getAll();
    paymentQueue = payments || [];
  } catch (error) {
    console.error('Failed to load payment queue:', error);
    paymentQueue = [];
  }
}

// IndexedDB helper
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nepa-pwa', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('paymentQueue')) {
        db.createObjectStore('paymentQueue', { keyPath: 'id' });
      }
    };
  });
}

// Utility functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  );
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

function isPaymentRequest(request) {
  const url = new URL(request.url);
  return url.pathname === '/api/payments' && request.method === 'POST';
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const responseDate = new Date(dateHeader);
  const now = new Date();
  return (now - responseDate) > maxAge;
}

async function enforceCacheSize(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  
  // Remove oldest entries
  const keysToRemove = keys.slice(0, keys.length - maxEntries);
  await Promise.all(keysToRemove.map(key => cache.delete(key)));
}

function createOfflineResponse() {
  return new Response(JSON.stringify({
    error: 'Offline',
    message: 'You are currently offline. Please check your internet connection.'
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize payment queue on service worker start
loadPaymentQueue();
