'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
// Removed heroicons import - using inline SVG instead
import { Event } from '@/types';
import { useEvents } from '@/hooks/useEvents';
import EventsTimeline from '@/components/live-events/EventsTimeline';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';

export default function TimelinePage() {
  const searchParams = useSearchParams();
  const tag = searchParams.get('tag');
  
  const { events, loading, error } = useEvents({
    tag: tag || undefined
  });

  const [timelineState, setTimelineState] = useState({
    isPlaying: false,
    currentTime: null,
    selectedRange: null
  });

  const handleTimelineChange = (state: any) => {
    setTimelineState(prev => ({ ...prev, ...state }));
  };

  const handleDateRangeSelect = (start: Date, end: Date) => {
    setTimelineState(prev => ({
      ...prev,
      selectedRange: { start, end }
    }));
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Timeline"
        message="There was an error loading the timeline data."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/intelligence-center"
            className="inline-flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Intelligence Center
          </Link>
          
          <h1 className="text-3xl font-bold text-white">
            Timeline
            {tag && (
              <span className="ml-3 text-lg font-normal text-gray-400">
                Filtered by: {tag}
              </span>
            )}
          </h1>
          
          <p className="mt-2 text-gray-400">
            Explore our deduplicated, geotagged summaries of global events
          </p>
        </div>

        {/* Timeline component */}
        <EventsTimeline
          events={events}
          timelineState={timelineState}
          onChange={handleTimelineChange}
          onDateRangeSelect={handleDateRangeSelect}
        />
      </div>
    </div>
  );
}