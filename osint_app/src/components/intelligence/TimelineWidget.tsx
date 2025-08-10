'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Event } from '@/types';
import { formatEscalationScore, getEscalationColor } from '@/utils/escalationUtils';
import { formatDateCompact } from '@/utils/dateUtils';
// Removed heroicons import - using inline SVG instead

interface TimelineWidgetProps {
  events: Event[];
  className?: string;
}

type SortMode = 'recent' | 'severe';

export default function TimelineWidget({ events, className = '' }: TimelineWidgetProps) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Sort and filter events
  const displayedEvents = useMemo(() => {
    let sorted = [...events];
    
    if (sortMode === 'recent') {
      sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else {
      // Sort by escalation score (severe first)
      sorted.sort((a, b) => {
        const scoreA = (a as any).escalation_score || 5;
        const scoreB = (b as any).escalation_score || 5;
        return scoreB - scoreA;
      });
    }

    // Always show only 3 items max in the widget
    return sorted.slice(0, 3);
  }, [events, sortMode]);

  const handleEventClick = (event: Event) => {
    // Navigate to timeline detail view using Next.js router
    router.push(`/timeline/${event.id}`);
  };

  const handleSourceClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Open source in new tab - check for source_url first, then source_urls array
    const sourceUrl = (event as any).source_url || (event.source_urls && event.source_urls.length > 0 ? event.source_urls[0] : null);
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Header with filters */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Timeline</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Sort by:</span>
            <div className="flex bg-gray-700 rounded-md">
              <button
                onClick={() => setSortMode('recent')}
                className={`px-3 py-1 text-sm rounded-l-md transition-colors ${
                  sortMode === 'recent'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Most Recent
              </button>
              <button
                onClick={() => setSortMode('severe')}
                className={`px-3 py-1 text-sm rounded-r-md transition-colors ${
                  sortMode === 'severe'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Most Severe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Events list - fixed height for 3 items */}
      <div className="max-h-[320px] overflow-y-auto">
        {displayedEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>No events to display</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {displayedEvents.map((event) => {
              const escalationScore = (event as any).escalation_score || 5;
              const escalationColor = getEscalationColor(escalationScore);

              return (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="p-4 hover:bg-gray-700 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Event title */}
                      <h4 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                        {event.title}
                      </h4>
                      
                      {/* Event metadata */}
                      <div className="mt-1 flex items-center space-x-3 text-xs text-gray-400">
                        <span>{formatDateCompact(new Date(event.timestamp))}</span>
                        <span>•</span>
                        <span>{event.country}</span>
                        {event.city && (
                          <>
                            <span>•</span>
                            <span>{event.city}</span>
                          </>
                        )}
                      </div>

                      {/* Event summary */}
                      <p className="mt-1 text-xs text-gray-300 line-clamp-2">
                        {event.summary}
                      </p>

                      {/* Tags and severity */}
                      <div className="mt-2 flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${escalationColor}`}>
                          Score: {formatEscalationScore(escalationScore)}
                        </span>
                        {event.event_type && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                            {event.event_type}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Source link */}
                    <button
                      onClick={(e) => handleSourceClick(event, e)}
                      className="ml-3 p-1 text-gray-400 hover:text-white transition-colors"
                      title="View source"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with CTA */}
      <div className="p-4 border-t border-gray-700">
        <Link
          href="/timeline"
          className="flex items-center justify-end text-sm text-blue-500 hover:text-blue-400 transition-colors group"
        >
          <span className="mr-1">→</span> See full list of recent events
        </Link>
      </div>
    </div>
  );
}