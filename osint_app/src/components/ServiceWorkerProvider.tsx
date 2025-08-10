'use client';

import React, { useEffect, useState, memo } from 'react';
import { serviceWorkerUtils } from '@/utils/serviceWorker';

interface ServiceWorkerState {
  isSupported: boolean;
  isInstalled: boolean;
  isUpdateAvailable: boolean;
  isPWAInstallable: boolean;
  isPWAInstalled: boolean;
}

const ServiceWorkerProvider = memo(({ children }: { children: React.ReactNode }) => {
  const [swState, setSwState] = useState<ServiceWorkerState>({
    isSupported: false,
    isInstalled: false,
    isUpdateAvailable: false,
    isPWAInstallable: false,
    isPWAInstalled: false
  });
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    // Check service worker support
    const isSupported = 'serviceWorker' in navigator;
    const isPWAInstalled = serviceWorkerUtils.isPWAInstalled();
    
    setSwState(prev => ({
      ...prev,
      isSupported,
      isPWAInstalled
    }));

    if (!isSupported) {
      console.warn('Service workers not supported in this browser');
      return;
    }

    // Register service worker with custom handlers
    serviceWorkerUtils.register('/sw.js', {
      enablePush: false, // Explicitly disable push notifications
      enableBackgroundSync: false, // Also disable background sync for Safari
      onSuccess: (registration) => {
        console.log('✅ Service worker registered successfully');
        setSwState(prev => ({ ...prev, isInstalled: true }));
      },
      onUpdate: (registration) => {
        console.log('🔄 Service worker update available');
        setSwState(prev => ({ ...prev, isUpdateAvailable: true }));
        setShowUpdateNotification(true);
      },
      onError: (error) => {
        console.error('❌ Service worker registration failed:', error);
      }
    });

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setSwState(prev => ({ ...prev, isPWAInstallable: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installation
    const handleAppInstalled = () => {
      setSwState(prev => ({ 
        ...prev, 
        isPWAInstalled: true, 
        isPWAInstallable: false 
      }));
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleUpdateServiceWorker = () => {
    serviceWorkerUtils.skipWaiting();
    setShowUpdateNotification(false);
  };

  const handleDismissUpdate = () => {
    setShowUpdateNotification(false);
  };

  return (
    <>
      {children}
      
      {/* Service Worker Update Notification */}
      {showUpdateNotification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">Update Available</h3>
              <p className="text-xs text-blue-200 mt-1">
                A new version of Argos is available with improvements and bug fixes.
              </p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={handleUpdateServiceWorker}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1 rounded transition-colors"
                >
                  Update Now
                </button>
                <button
                  onClick={handleDismissUpdate}
                  className="bg-transparent hover:bg-blue-700/50 text-blue-200 text-xs px-3 py-1 rounded border border-blue-400 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={handleDismissUpdate}
              className="flex-shrink-0 text-blue-200 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* PWA Install Prompt - This will be shown by the service worker utility */}
      
      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />
    </>
  );
});

// Connection status indicator component
const ConnectionStatusIndicator = memo(() => {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (!online) {
        setShowOfflineMessage(true);
      } else if (showOfflineMessage) {
        // Show "back online" message briefly
        setTimeout(() => setShowOfflineMessage(false), 3000);
      }
    };

    updateOnlineStatus();
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [showOfflineMessage]);

  if (!showOfflineMessage && isOnline) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 z-50 rounded-lg shadow-lg p-3 text-sm font-medium transition-all duration-300 ${
      isOnline 
        ? 'bg-green-600 text-white' 
        : 'bg-red-600 text-white'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-200' : 'bg-red-200 animate-pulse'
        }`} />
        <span>
          {isOnline ? 'Back Online' : 'You\'re Offline'}
        </span>
      </div>
      {!isOnline && (
        <div className="text-xs text-red-200 mt-1">
          Some features may be limited
        </div>
      )}
    </div>
  );
});

ServiceWorkerProvider.displayName = 'ServiceWorkerProvider';
ConnectionStatusIndicator.displayName = 'ConnectionStatusIndicator';

export default ServiceWorkerProvider;