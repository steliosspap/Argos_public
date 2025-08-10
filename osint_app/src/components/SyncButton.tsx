'use client';

import React, { useState, useCallback, useRef } from 'react';
// Removed heroicons import - using inline SVG instead
import { debounce } from '@/utils/apiUtils';
import LoadingProgress from './LoadingProgress';

interface SyncButtonProps {
  onSync: () => Promise<void>;
  lastUpdated?: Date;
  className?: string;
  autoSync?: boolean;
  syncInterval?: number; // in minutes
}

export default function SyncButton({ 
  onSync, 
  lastUpdated,
  className = '',
  autoSync = false,
  syncInterval = 5
}: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | undefined>();
  const [showProgress, setShowProgress] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced sync function to prevent rapid clicks
  const debouncedSync = useCallback(
    debounce(async () => {
      if (isSyncing) return;

      setIsSyncing(true);
      setShowProgress(true);
      setSyncProgress(0);

      try {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setSyncProgress(prev => {
            if (prev === undefined) return 10;
            if (prev >= 90) return prev;
            return prev + Math.random() * 20;
          });
        }, 300);

        await onSync();

        clearInterval(progressInterval);
        setSyncProgress(100);

        // Hide progress after completion
        setTimeout(() => {
          setShowProgress(false);
          setSyncProgress(undefined);
        }, 1000);
      } catch (error) {
        console.error('Sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 1000), // 1 second debounce
    [onSync, isSyncing]
  );

  // Auto-sync functionality
  React.useEffect(() => {
    if (!autoSync) return;

    const scheduleSync = () => {
      syncTimeoutRef.current = setTimeout(() => {
        debouncedSync();
        scheduleSync(); // Schedule next sync
      }, syncInterval * 60 * 1000);
    };

    scheduleSync();

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [autoSync, syncInterval, debouncedSync]);

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Sync button */}
      <button
        onClick={debouncedSync}
        disabled={isSyncing}
        className={`
          flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all
          ${isSyncing 
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
        title={isSyncing ? 'Syncing...' : 'Sync now'}
      >
        <svg 
          className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
      </button>

      {/* Last updated text */}
      {lastUpdated && !showProgress && (
        <p className="mt-2 text-xs text-gray-400 text-center">
          Last updated: {formatLastUpdated(lastUpdated)}
        </p>
      )}

      {/* Progress indicator */}
      {showProgress && (
        <div className="absolute top-full mt-2 left-0 right-0 z-10">
          <LoadingProgress
            message="Syncing live events..."
            progress={syncProgress}
          />
        </div>
      )}

      {/* Auto-sync indicator */}
      {autoSync && !isSyncing && (
        <div className="mt-2 flex items-center justify-center">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
          <span className="text-xs text-gray-400">
            Auto-sync every {syncInterval} minutes
          </span>
        </div>
      )}
    </div>
  );
}