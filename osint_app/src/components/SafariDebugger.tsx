'use client';

import { useEffect, useState } from 'react';
import { isSafari, testSafariCompatibility } from '@/utils/safari-fetch';
import { storage } from '@/utils/storage';

interface DebugInfo {
  isSafari: boolean;
  compatibility: {
    localStorage: boolean;
    cookies: boolean;
    fetch: boolean;
    serviceWorker: boolean;
  } | null;
  authToken: string | null;
  apiHealth: any;
  errors: string[];
}

export function SafariDebugger() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    isSafari: false,
    compatibility: null,
    authToken: null,
    apiHealth: null,
    errors: []
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development or if there's a debug flag
    const showDebug = process.env.NODE_ENV === 'development' || 
                     window.location.search.includes('debug=true');
    
    if (showDebug && isSafari()) {
      setIsVisible(true);
      runDiagnostics();
    }
  }, []);

  const runDiagnostics = async () => {
    const errors: string[] = [];
    
    try {
      // Test Safari compatibility
      const compatibility = await testSafariCompatibility();
      
      // Get auth token
      const authToken = storage.getAuthToken();
      
      // Test API health
      let apiHealth = null;
      try {
        const response = await fetch('/api/health');
        apiHealth = await response.json();
      } catch (e) {
        errors.push(`Health check failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
      
      // Test intel-data endpoint
      try {
        const response = await fetch('/api/intel-data?types=events&limit=1', {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        
        if (!response.ok) {
          const text = await response.text();
          errors.push(`Intel-data endpoint failed: ${response.status} - ${text}`);
        }
      } catch (e) {
        errors.push(`Intel-data fetch failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
      
      setDebugInfo({
        isSafari: true,
        compatibility,
        authToken: authToken ? `${authToken.substring(0, 20)}...` : null,
        apiHealth,
        errors
      });
      
    } catch (e) {
      console.error('Safari diagnostics error:', e);
      errors.push(`Diagnostics error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-lg p-4 text-sm z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-yellow-800">Safari Debug Info</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-yellow-600 hover:text-yellow-800"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-yellow-700">
        <div>
          <strong>Browser:</strong> Safari Detected
        </div>
        
        {debugInfo.compatibility && (
          <div>
            <strong>Compatibility:</strong>
            <ul className="ml-4 text-xs">
              <li>LocalStorage: {debugInfo.compatibility.localStorage ? '✅' : '❌'}</li>
              <li>Cookies: {debugInfo.compatibility.cookies ? '✅' : '❌'}</li>
              <li>Fetch API: {debugInfo.compatibility.fetch ? '✅' : '❌'}</li>
              <li>Service Worker: {debugInfo.compatibility.serviceWorker ? '✅' : '❌'}</li>
            </ul>
          </div>
        )}
        
        <div>
          <strong>Auth:</strong> {debugInfo.authToken || 'No token'}
        </div>
        
        {debugInfo.apiHealth && (
          <div>
            <strong>API Status:</strong>
            <ul className="ml-4 text-xs">
              <li>Database: {debugInfo.apiHealth.database?.connected ? '✅' : '❌'}</li>
              <li>Supabase: {debugInfo.apiHealth.environment?.supabaseInitialized ? '✅' : '❌'}</li>
            </ul>
          </div>
        )}
        
        {debugInfo.errors.length > 0 && (
          <div>
            <strong>Errors:</strong>
            <ul className="ml-4 text-xs text-red-600">
              {debugInfo.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        <button
          onClick={runDiagnostics}
          className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
        >
          Re-run Diagnostics
        </button>
      </div>
    </div>
  );
}