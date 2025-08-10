// Safari-compatible storage utility
// Handles cases where localStorage might be blocked or unavailable

interface StorageInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

class SafariCompatibleStorage implements StorageInterface {
  private memoryStorage: Map<string, string> = new Map();
  private isLocalStorageAvailable: boolean = false;

  constructor() {
    this.checkLocalStorageAvailability();
  }

  private checkLocalStorageAvailability(): void {
    try {
      const testKey = '__localStorage_test__';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        this.isLocalStorageAvailable = true;
      }
    } catch (e) {
      // localStorage is not available (Safari private mode, etc.)
      console.warn('localStorage not available, using memory storage');
      this.isLocalStorageAvailable = false;
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.isLocalStorageAvailable) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('Error accessing localStorage:', e);
    }
    return this.memoryStorage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    try {
      if (this.isLocalStorageAvailable) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Error writing to localStorage:', e);
    }
    this.memoryStorage.set(key, value);
  }

  removeItem(key: string): void {
    try {
      if (this.isLocalStorageAvailable) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Error removing from localStorage:', e);
    }
    this.memoryStorage.delete(key);
  }

  clear(): void {
    try {
      if (this.isLocalStorageAvailable) {
        window.localStorage.clear();
      }
    } catch (e) {
      console.warn('Error clearing localStorage:', e);
    }
    this.memoryStorage.clear();
  }
}

// Create a singleton instance
export const safeStorage = new SafariCompatibleStorage();

// Helper functions for common operations
export const storage = {
  getAuthToken(): string | null {
    return safeStorage.getItem('authToken');
  },
  
  setAuthToken(token: string): void {
    safeStorage.setItem('authToken', token);
  },
  
  removeAuthToken(): void {
    safeStorage.removeItem('authToken');
  },
  
  getItem(key: string): string | null {
    return safeStorage.getItem(key);
  },
  
  setItem(key: string, value: string): void {
    safeStorage.setItem(key, value);
  },
  
  removeItem(key: string): void {
    safeStorage.removeItem(key);
  },
  
  clear(): void {
    safeStorage.clear();
  }
};

// Check if we're in Safari
export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = window.navigator.userAgent;
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOSSafari = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  
  return isSafariBrowser || isIOSSafari;
};

// Check if we're in private browsing mode
export const isPrivateBrowsing = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  try {
    // Try to use localStorage
    const testKey = '__private_mode_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    
    // In Safari, check if storage quota is 0
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { quota } = await navigator.storage.estimate();
      if (quota && quota < 120000000) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    return true;
  }
};