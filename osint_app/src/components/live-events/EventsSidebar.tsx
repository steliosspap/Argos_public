'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Event } from '@/types';

interface EventsSidebarProps {
  events: Event[];
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

const getEscalationScoreColor = (score: number): string => {
  if (score >= 7) return 'text-red-400';
  if (score >= 4) return 'text-yellow-400';
  return 'text-blue-400';
};

export default function EventsSidebar({
  events,
  selectedEvent,
  onEventSelect,
  loading,
  error,
  hasNextPage,
  onLoadMore,
  isOpen,
  onClose
}: EventsSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

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

  // Scroll to selected event
  useEffect(() => {
    if (selectedEvent && sidebarRef.current) {
      const eventElement = sidebarRef.current.querySelector(`[data-event-id="${selectedEvent.id}"]`);
      if (eventElement) {
        eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedEvent]);

  const handleEventClick = useCallback((event: Event) => {
    onEventSelect(event);
  }, [onEventSelect]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 h-full w-80 md:w-96 bg-gray-900 border-r border-gray-800 z-50 md:relative md:z-auto flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Live Events</h2>
                  <p className="text-sm text-gray-400">
                    {events.length} events {loading && '• Updating...'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close sidebar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Events List */}
            <div 
              ref={sidebarRef}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#4b5563 #1f2937'
              }}
            >
              {error && (
                <div className="p-4 m-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {events.length === 0 && !loading ? (
                <div className="p-8 text-center">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-400 text-sm">No events found</p>
                  <p className="text-gray-500 text-xs mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {events.map((event, index) => {
                    const escalationScore = (event as any).escalation_score || 0;
                    const isSelected = selectedEvent?.id === event.id;

                    return (
                      <motion.div
                        key={event.id}
                        data-event-id={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.05, 1) }}
                        onClick={() => handleEventClick(event)}
                        className={`
                          p-3 rounded-lg cursor-pointer transition-all duration-200 border
                          ${isSelected 
                            ? 'bg-blue-600/20 border-blue-500/50 shadow-lg' 
                            : 'hover:bg-gray-800/80 border-transparent hover:border-gray-700'
                          }
                        `}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSeverityColor(event.severity)}`} />
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          <span className={`text-xs font-medium ${getEscalationScoreColor(escalationScore)}`}>
                            {escalationScore.toFixed(1)}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-medium text-white mb-2 line-clamp-2">
                          {event.title}
                        </h3>

                        {/* Summary */}
                        {event.summary && (
                          <p className="text-xs text-gray-400 mb-2 line-clamp-3">
                            {event.summary}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-2">
                            <span>{event.country}</span>
                            {event.region && (
                              <>
                                <span>•</span>
                                <span>{event.region}</span>
                              </>
                            )}
                          </div>
                          {event.channel && (
                            <span className="bg-gray-700 px-2 py-1 rounded text-xs">
                              {event.channel}
                            </span>
                          )}
                        </div>

                        {/* External link indicator */}
                        {event.source_url && (
                          <div className="mt-2 pt-2 border-t border-gray-700">
                            <a
                              href={event.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <span>View source</span>
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Loading indicator for infinite scroll */}
                  {hasNextPage && (
                    <div ref={loadingRef} className="p-4 text-center">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-xs text-gray-400">Loading more events...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer stats */}
            <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/50">
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Total Events:</span>
                  <span className="text-white">{events.length}</span>
                </div>
                {events.length > 0 && (
                  <div className="flex justify-between">
                    <span>Latest:</span>
                    <span className="text-white">
                      {formatTimestamp(events[0]?.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}