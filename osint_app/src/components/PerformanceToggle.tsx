'use client';

import React, { useState, memo } from 'react';
import PerformanceDashboard from './PerformanceDashboard';

const PerformanceToggle = memo(() => {
  const [showDashboard, setShowDashboard] = useState(false);

  // Only show in development or when explicitly enabled
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isEnabled = isDevelopment || (typeof window !== 'undefined' && localStorage.getItem('enable-performance-dashboard') === 'true');

  if (!isEnabled) return null;

  return (
    <>
      <button
        onClick={() => setShowDashboard(true)}
        className="fixed bottom-4 right-4 z-40 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Performance Dashboard"
        aria-label="Open Performance Dashboard"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      <PerformanceDashboard 
        isVisible={showDashboard} 
        onClose={() => setShowDashboard(false)} 
      />
    </>
  );
});

PerformanceToggle.displayName = 'PerformanceToggle';

export default PerformanceToggle;