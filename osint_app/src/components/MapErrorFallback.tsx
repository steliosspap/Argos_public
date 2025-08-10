'use client';

import React from 'react';

interface MapErrorFallbackProps {
  error?: string;
  className?: string;
}

export default function MapErrorFallback({ error, className = '' }: MapErrorFallbackProps) {
  return (
    <div className={`flex items-center justify-center bg-gray-900 ${className}`}>
      <div className="text-center p-8">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <h3 className="text-xl font-semibold text-gray-300 mb-2">Map Temporarily Unavailable</h3>
        <p className="text-gray-500 mb-4">
          {error || 'Unable to load the intelligence map. Please check your connection and try again.'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}