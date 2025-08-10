'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// Removed heroicons import - using inline SVG instead
import { Event } from '@/types';
import { formatDateTime } from '@/utils/dateUtils';
import { formatEscalationScore, getEscalationColor, getEscalationLevel } from '@/utils/escalationUtils';
import { createClient } from '@supabase/supabase-js';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorState from '@/components/ErrorState';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TimelineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setEvent(data);
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchEvent();
    }
  }, [params.id]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !event) {
    return (
      <ErrorState
        title="Event Not Found"
        message="The event you're looking for could not be found."
        onRetry={() => router.push('/timeline')}
        retryLabel="Back to Timeline"
      />
    );
  }

  const escalationScore = (event as any).escalation_score || 5;
  const escalationColor = getEscalationColor(escalationScore);
  const escalationLevel = getEscalationLevel(escalationScore);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back button */}
        <Link
          href="/timeline"
          className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Timeline
        </Link>

        {/* Event details */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-4">{event.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className={`inline-flex items-center px-3 py-1 rounded-md font-medium ${escalationColor}`}>
                {escalationLevel} ({formatEscalationScore(escalationScore)})
              </span>
              
              <span className="text-gray-400">
                {formatDateTime(new Date(event.timestamp))}
              </span>
              
              <span className="text-gray-400">
                {event.country}
                {event.city && ` • ${event.city}`}
              </span>
              
              {event.event_type && (
                <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-gray-700 text-gray-300">
                  {event.event_type}
                </span>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">Summary</h2>
            <p className="text-gray-300 leading-relaxed">{event.summary}</p>
          </div>

          {/* Sources */}
          {event.source_urls && event.source_urls.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-2">Sources</h2>
              <div className="space-y-2">
                {event.source_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {new URL(url).hostname}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-2">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag, index) => (
                  <Link
                    key={index}
                    href={`/intelligence-center?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="border-t border-gray-700 pt-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-400">Event ID</dt>
                <dd className="text-gray-300 font-mono">{event.id}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Channel</dt>
                <dd className="text-gray-300">{event.channel}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Reliability Score</dt>
                <dd className="text-gray-300">{event.reliability_score}/10</dd>
              </div>
              {event.location?.coordinates && (
                <div>
                  <dt className="text-gray-400">Coordinates</dt>
                  <dd className="text-gray-300 font-mono">
                    {event.location.coordinates[1].toFixed(4)}, {event.location.coordinates[0].toFixed(4)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}