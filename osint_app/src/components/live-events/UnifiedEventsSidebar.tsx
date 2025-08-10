'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Event } from '@/types';
import ArgosPulseCard from './ArgosPulseCard';

interface UnifiedEventsSidebarProps {
  liveEvents: Event[];
  pulseReports: Event[];
  selectedEvent: Event | null;
  onEventSelect: (event: Event) => void;
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  onLoadMore: () => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
};

const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

export default function UnifiedEventsSidebar({
  liveEvents,
  pulseReports,
  selectedEvent,
  onEventSelect,
  loading,
  error,
  hasNextPage,
  onLoadMore,
  isOpen,
  onClose
}: UnifiedEventsSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'pulse'>('all');

  // Combine and sort events by timestamp
  const allEvents = [...liveEvents, ...pulseReports].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Filter events based on active tab
  const displayEvents = activeTab === 'all' 
    ? allEvents 
    : activeTab === 'live' 
    ? liveEvents 
    : pulseReports;

  // Infinite scroll implementation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, loading, onLoadMore]);

  const isPulseReport = (event: Event) => event.channel === 'news';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={sidebarRef}
          initial={{ x: -400 }}
          animate={{ x: 0 }}
          exit={{ x: -400 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="h-full bg-gray-900 border-r border-gray-800 flex flex-col"
        >
          {/* Header */}
          <div className="p-3 md:p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-base md:text-lg font-semibold text-white">Intelligence Feed</h2>
              <button
                onClick={onClose}
                className="md:hidden p-2 -m-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 px-2 md:px-3 py-2 md:py-1.5 rounded text-xs md:text-sm font-medium transition-colors touch-manipulation ${
                  activeTab === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">All</span>
                <span className="sm:hidden">All</span>
                <span className="ml-1">({allEvents.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`flex-1 px-2 md:px-3 py-2 md:py-1.5 rounded text-xs md:text-sm font-medium transition-colors touch-manipulation ${
                  activeTab === 'live'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">Live</span>
                <span className="sm:hidden">Live</span>
                <span className="ml-1">({liveEvents.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('pulse')}
                className={`flex-1 px-2 md:px-3 py-2 md:py-1.5 rounded text-xs md:text-sm font-medium transition-colors touch-manipulation flex items-center justify-center space-x-1 ${
                  activeTab === 'pulse'
                    ? 'bg-purple-900/50 text-purple-300'
                    : 'text-gray-400 hover:text-purple-300'
                }`}
              >
                <span className="text-xs">●</span>
                <span className="hidden sm:inline">Pulse</span>
                <span className="sm:hidden">Pulse</span>
                <span className="ml-1">({pulseReports.length})</span>
              </button>
            </div>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400">Last Hour</div>
                <div className="text-white font-semibold">
                  {displayEvents.filter(e => 
                    new Date(e.timestamp) > new Date(Date.now() - 3600000)
                  ).length}
                </div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400">Critical</div>
                <div className="text-red-400 font-semibold">
                  {displayEvents.filter(e => e.severity === 'critical').length}
                </div>
              </div>
            </div>
          </div>

          {/* Event List */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-800 m-4 rounded">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {displayEvents.length === 0 && !loading && (
              <div className="p-8 text-center">
                <p className="text-gray-500">No events to display</p>
              </div>
            )}

            <div className="p-3 md:p-4 space-y-2">
              {displayEvents.map((event) => (
                <div key={event.id} data-event-id={event.id}>
                  {isPulseReport(event) ? (
                    <ArgosPulseCard
                      event={event}
                      onSelect={() => onEventSelect(event)}
                      isSelected={selectedEvent?.id === event.id}
                    />
                  ) : (
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onEventSelect(event)}
                      className={`p-3 bg-gray-800 rounded-lg cursor-pointer transition-all touch-manipulation ${
                        selectedEvent?.id === event.id
                          ? 'ring-2 ring-blue-500 bg-gray-700'
                          : 'hover:bg-gray-700 active:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${getSeverityColor(event.severity)}`} />
                          <span className="text-xs text-gray-400">{formatTimestamp(event.timestamp)}</span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-400">{event.channel}</span>
                        </div>
                        {event.reliability && (
                          <span className="text-xs text-gray-500">{event.reliability}/10</span>
                        )}
                      </div>
                      
                      <h3 className="text-sm font-medium text-white mb-1">{event.title}</h3>
                      
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <span>{event.country}</span>
                        {event.region && event.region !== 'Unknown' && (
                          <>
                            <span>•</span>
                            <span>{event.region}</span>
                          </>
                        )}
                        {event.event_classifier && event.event_classifier.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400">{event.event_classifier[0]}</span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              <div ref={loadingRef} className="py-4">
                {loading && (
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}