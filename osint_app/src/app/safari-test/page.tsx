'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/utils/storage';
import { isSafari } from '@/utils/safari-fetch';

export default function SafariTestPage() {
  const [results, setResults] = useState<any>({});
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    const testResults: any = {};

    // Test 1: Browser Detection
    testResults.browserDetection = {
      isSafari: isSafari(),
      userAgent: navigator.userAgent,
    };

    // Test 2: Storage
    try {
      storage.setItem('test', 'value');
      const value = storage.getItem('test');
      storage.removeItem('test');
      testResults.storage = { success: true, value };
    } catch (e) {
      testResults.storage = { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }

    // Test 3: Auth Token
    const authToken = storage.getAuthToken();
    testResults.authToken = {
      present: !!authToken,
      length: authToken?.length || 0,
      preview: authToken ? `${authToken.substring(0, 20)}...` : null,
    };

    // Test 4: Health Check
    try {
      const healthResponse = await fetch('/api/health');
      testResults.healthCheck = {
        status: healthResponse.status,
        ok: healthResponse.ok,
        data: await healthResponse.json(),
      };
    } catch (e) {
      testResults.healthCheck = { error: e instanceof Error ? e.message : 'Failed' };
    }

    // Test 5: API Endpoints
    const endpoints = ['/api/news', '/api/arms-deals', '/api/events'];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Accept': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
          credentials: 'include',
        });

        const contentType = response.headers.get('content-type');
        let body;
        
        if (contentType && contentType.includes('application/json')) {
          body = await response.json();
        } else {
          body = await response.text();
        }

        testResults[endpoint] = {
          status: response.status,
          ok: response.ok,
          contentType,
          bodyType: typeof body,
          bodyPreview: typeof body === 'string' ? body.substring(0, 200) : JSON.stringify(body).substring(0, 200),
        };
      } catch (e) {
        testResults[endpoint] = { error: e instanceof Error ? e.message : 'Failed' };
      }
    }

    // Test 6: Get Preferences (if auth token exists)
    if (authToken) {
      try {
        const response = await fetch('/api/account/get-preferences', {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          credentials: 'include',
        });

        const contentType = response.headers.get('content-type');
        let body;
        
        if (contentType && contentType.includes('application/json')) {
          body = await response.json();
        } else {
          body = await response.text();
        }

        testResults.getPreferences = {
          status: response.status,
          ok: response.ok,
          contentType,
          body: typeof body === 'string' ? body : JSON.stringify(body),
        };
      } catch (e) {
        testResults.getPreferences = { error: e instanceof Error ? e.message : 'Failed' };
      }
    }

    setResults(testResults);
    setIsRunning(false);
  };

  useEffect(() => {
    if (isSafari()) {
      runTests();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Safari Compatibility Test</h1>
        
        <div className="mb-4">
          <button
            onClick={runTests}
            disabled={isRunning}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </button>
        </div>

        <div className="space-y-6">
          {Object.entries(results).map(([key, value]) => (
            <div key={key} className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-3">{key}</h2>
              <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>

        {Object.keys(results).length === 0 && !isRunning && (
          <div className="text-center text-gray-500 dark:text-gray-400">
            Click "Run Tests" to start Safari compatibility testing
          </div>
        )}
      </div>
    </div>
  );
}