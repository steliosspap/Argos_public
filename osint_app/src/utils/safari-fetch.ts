// Safari-compatible fetch utility that handles authentication and headers properly

import { storage } from './storage';

// Detect if running in Safari
export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = window.navigator.userAgent;
  const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
  const isIOSSafari = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  
  return isSafariBrowser || isIOSSafari;
};

// Safari-compatible fetch options
export interface SafariFetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

// Enhanced fetch for Safari compatibility
export async function safariFetch(url: string, options: SafariFetchOptions = {}): Promise<Response> {
  const { requiresAuth = false, ...fetchOptions } = options;
  
  // Build headers
  const headers = new Headers(fetchOptions.headers || {});
  
  // Always set content type for JSON
  if (!headers.has('Content-Type') && fetchOptions.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  
  // Add accept header
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  
  // Add authentication if required
  if (requiresAuth) {
    const token = storage.getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      console.warn('[Safari Fetch] No auth token available');
    }
  }
  
  // Safari-specific headers
  if (isSafari()) {
    // Prevent caching issues in Safari
    headers.set('Cache-Control', 'no-cache');
    headers.set('Pragma', 'no-cache');
    
    // Add timestamp to URL to prevent caching
    const urlObj = new URL(url, window.location.origin);
    urlObj.searchParams.set('_t', Date.now().toString());
    url = urlObj.toString();
  }
  
  // Log request details in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Safari Fetch] Request:', {
      url,
      method: fetchOptions.method || 'GET',
      headers: Object.fromEntries(headers.entries()),
      isSafari: isSafari()
    });
  }
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      // Safari-specific fetch options
      credentials: requiresAuth ? 'include' : 'same-origin',
      mode: 'cors',
    });
    
    // Log response details in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Safari Fetch] Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
    }
    
    // Handle non-JSON responses in Safari
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Try to get text response for better error handling
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('[Safari Fetch] Error:', error);
    
    // Safari-specific error handling
    if (isSafari() && error instanceof TypeError && error.message.includes('Load failed')) {
      throw new Error('Network request failed. This might be due to Safari security restrictions. Please check your network settings.');
    }
    
    throw error;
  }
}

// Wrapper for JSON API calls
export async function safariJsonFetch<T = any>(
  url: string, 
  options: SafariFetchOptions = {}
): Promise<T> {
  const response = await safariFetch(url, options);
  
  // Parse JSON with error handling
  try {
    return await response.json();
  } catch (error) {
    console.error('[Safari Fetch] JSON parse error:', error);
    throw new Error('Invalid JSON response from server');
  }
}

// Utility to test Safari compatibility
export async function testSafariCompatibility(): Promise<{
  localStorage: boolean;
  cookies: boolean;
  fetch: boolean;
  serviceWorker: boolean;
}> {
  const results = {
    localStorage: false,
    cookies: false,
    fetch: false,
    serviceWorker: false
  };
  
  // Test localStorage
  try {
    const testKey = '__safari_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    results.localStorage = true;
  } catch (e) {
    console.warn('LocalStorage not available in Safari');
  }
  
  // Test cookies
  try {
    document.cookie = '__safari_test__=test; path=/';
    results.cookies = document.cookie.includes('__safari_test__');
    document.cookie = '__safari_test__=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (e) {
    console.warn('Cookies not available in Safari');
  }
  
  // Test fetch
  try {
    const response = await fetch('/api/health', { method: 'HEAD' });
    results.fetch = true;
  } catch (e) {
    console.warn('Fetch API issues in Safari');
  }
  
  // Test service worker
  results.serviceWorker = 'serviceWorker' in navigator;
  
  return results;
}