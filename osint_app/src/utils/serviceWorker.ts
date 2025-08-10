'use client';

// Service Worker registration and management utilities

export interface ServiceWorkerConfig {
  scope?: string;
  updateViaCache?: ServiceWorkerUpdateViaCache;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  enablePush?: boolean;
  enableBackgroundSync?: boolean;
}

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Default configuration
const DEFAULT_CONFIG: ServiceWorkerConfig = {
  scope: '/',
  updateViaCache: 'imports',
  enablePush: true,
  enableBackgroundSync: true
};

let deferredPrompt: PWAInstallPrompt | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

// Register service worker
export async function registerServiceWorker(
  swUrl: string = '/sw.js',
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported in this browser');
    return null;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Service worker registration disabled in development');
    return null;
  }

  try {
    console.log('📦 Registering service worker...');
    
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: finalConfig.scope,
      updateViaCache: finalConfig.updateViaCache
    });

    swRegistration = registration;

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      console.log('🔄 New service worker found, updating...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New worker is available
            console.log('✅ New service worker available');
            finalConfig.onUpdate?.(registration);
          } else {
            // Service worker is now active
            console.log('✅ Service worker active for first time');
            finalConfig.onSuccess?.(registration);
          }
        }
      });
    });

    // Listen for controlling service worker changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service worker controller changed');
      window.location.reload();
    });

    // Don't automatically set up push notifications - wait for user interaction
    // if (finalConfig.enablePush) {
    //   await setupPushNotifications(registration);
    // }

    console.log('✅ Service worker registered successfully');
    finalConfig.onSuccess?.(registration);
    
    return registration;

  } catch (error) {
    console.error('❌ Service worker registration failed:', error);
    finalConfig.onError?.(error as Error);
    return null;
  }
}

// Unregister service worker
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    
    if (result) {
      console.log('✅ Service worker unregistered successfully');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Service worker unregistration failed:', error);
    return false;
  }
}

// Update service worker
export async function updateServiceWorker(): Promise<void> {
  if (!swRegistration) {
    console.warn('No service worker registration found');
    return;
  }

  try {
    await swRegistration.update();
    console.log('🔄 Service worker update check completed');
  } catch (error) {
    console.error('❌ Service worker update failed:', error);
  }
}

// Skip waiting and activate new service worker
export function skipWaiting(): void {
  if (!swRegistration || !swRegistration.waiting) {
    console.warn('No waiting service worker found');
    return;
  }

  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

// Setup push notifications - must be called from user interaction
export async function setupPushNotifications(): Promise<boolean> {
  try {
    if (!swRegistration) {
      console.warn('Service worker not registered');
      return false;
    }

    if (!('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    // Check if we already have permission
    if (Notification.permission === 'granted') {
      return await subscribeToPush(swRegistration);
    }

    // Only request permission from user gesture
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push notifications permission denied');
      return false;
    }

    return await subscribeToPush(swRegistration);

  } catch (error) {
    console.error('❌ Push notification setup failed:', error);
    return false;
  }
}

// Subscribe to push notifications
async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    // You would typically get this from your server
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID public key not configured');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    console.log('✅ Push notifications enabled:', subscription);
    
    // Send subscription to your server
    await sendSubscriptionToServer(subscription);
    return true;

  } catch (error) {
    console.error('❌ Push subscription failed:', error);
    return false;
  }
}

// Send subscription to server
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    await fetch('/api/push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription)
    });
  } catch (error) {
    console.error('Failed to send subscription to server:', error);
  }
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

// PWA installation management
export function setupPWAInstall(): void {
  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (event) => {
    console.log('💾 PWA install prompt available');
    event.preventDefault();
    deferredPrompt = event as any;
    
    // Show custom install prompt
    showInstallPrompt();
  });

  // Listen for app installation
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    deferredPrompt = null;
    hideInstallPrompt();
  });
}

// Show PWA install prompt
function showInstallPrompt(): void {
  // PWA install prompt disabled - no banner will be shown
  console.log('PWA install prompt disabled');
}

// Install PWA
export async function installPWA(): Promise<void> {
  if (!deferredPrompt) {
    console.warn('No install prompt available');
    return;
  }

  try {
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    
    console.log('PWA install choice:', result.outcome);
    
    if (result.outcome === 'accepted') {
      console.log('✅ PWA installation accepted');
      // Reset prompt count on successful install
      localStorage.removeItem('pwa-install-prompt-count');
      localStorage.removeItem('pwa-install-dismissed');
    } else {
      console.log('❌ PWA installation dismissed');
    }
    
    deferredPrompt = null;
    hideInstallPrompt();
    
  } catch (error) {
    console.error('PWA installation failed:', error);
  }
}

// Dismiss install prompt
export function dismissInstallPrompt(): void {
  hideInstallPrompt();
  // Store dismissal in localStorage to avoid showing again soon
  localStorage.setItem('pwa-install-dismissed', Date.now().toString());
}

// Hide install prompt
function hideInstallPrompt(): void {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.remove();
  }
}

// Check if PWA is installed
export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone ||
         document.referrer.includes('android-app://');
}

// Get service worker registration
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

// Service worker utilities
export const serviceWorkerUtils = {
  register: registerServiceWorker,
  unregister: unregisterServiceWorker,
  update: updateServiceWorker,
  skipWaiting,
  installPWA,
  setupPWAInstall,
  isPWAInstalled,
  getRegistration: getServiceWorkerRegistration
};

// Initialize service worker on module load (client-side only)
if (typeof window !== 'undefined') {
  // Auto-register service worker with push notifications disabled
  registerServiceWorker('/sw.js', {
    enablePush: false, // Disable automatic push notification setup
    onUpdate: (registration) => {
      console.log('🔄 New service worker available, showing update notification');
      // You could show a notification to the user here
    },
    onSuccess: (registration) => {
      console.log('✅ Service worker active');
    },
    onError: (error) => {
      console.error('❌ Service worker error:', error);
    }
  });

  // PWA install prompt disabled
  // setupPWAInstall();
}