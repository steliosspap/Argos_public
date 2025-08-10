'use client';

import React, { useState } from 'react';
import { Event } from '@/types';
import { formatDateCompact } from '@/utils/dateUtils';
import { formatEscalationScore, getEscalationColor } from '@/utils/escalationUtils';
import { analytics } from '@/utils/analytics';
import ExpandableTags from '@/components/ExpandableTags';
// import { CompactBiasIndicator } from '@/components/analysis/CompactBiasIndicator';
// Removed heroicons import - using inline SVG instead

interface NewsCardProps {
  event: Event;
  relatedEvents?: Event[];
  onClick?: (event: Event) => void;
  sourceReliability?: number;
  discoveryRound?: 1 | 2;
}

// Map of source domains to display names/logos
const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  'bbc.com': 'BBC',
  'bbc.co.uk': 'BBC',
  'reuters.com': 'Reuters',
  'aljazeera.com': 'Al Jazeera',
  'cnn.com': 'CNN',
  'nytimes.com': 'New York Times',
  'theguardian.com': 'The Guardian',
  'washingtonpost.com': 'Washington Post',
  'apnews.com': 'Associated Press',
  'bloomberg.com': 'Bloomberg',
  'ft.com': 'Financial Times',
  'economist.com': 'The Economist',
  'wsj.com': 'Wall Street Journal',
  'foxnews.com': 'Fox News',
  'nbcnews.com': 'NBC News',
  'abcnews.go.com': 'ABC News',
  'cbsnews.com': 'CBS News',
  'npr.org': 'NPR',
  'dw.com': 'Deutsche Welle',
  'france24.com': 'France 24',
  'rt.com': 'RT',
  'nhk.or.jp': 'NHK World',
};

// Source reputation scores (higher is better)
const SOURCE_REPUTATION: Record<string, number> = {
  'reuters.com': 10,
  'apnews.com': 10,
  'bbc.com': 9,
  'bbc.co.uk': 9,
  'nytimes.com': 9,
  'washingtonpost.com': 9,
  'theguardian.com': 8,
  'bloomberg.com': 8,
  'ft.com': 8,
  'economist.com': 8,
  'wsj.com': 8,
  'npr.org': 8,
  'aljazeera.com': 7,
  'cnn.com': 7,
  'dw.com': 7,
  'france24.com': 7,
  'nbcnews.com': 6,
  'abcnews.go.com': 6,
  'cbsnews.com': 6,
  'foxnews.com': 5,
  'nhk.or.jp': 6,
  'rt.com': 4,
};

function getSourceInfo(url: string) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return {
      domain,
      displayName: SOURCE_DISPLAY_NAMES[domain] || domain,
      reputation: SOURCE_REPUTATION[domain] || 5
    };
  } catch {
    return {
      domain: 'unknown',
      displayName: 'Unknown Source',
      reputation: 1
    };
  }
}

export default function NewsCard({ event, relatedEvents = [], onClick, sourceReliability, discoveryRound }: NewsCardProps) {
  const [showSources, setShowSources] = useState(false);
  
  // Combine all source URLs from main event and related events
  const allSources = [
    ...(event.source_urls || []),
    ...relatedEvents.flatMap(e => e.source_urls || [])
  ].filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
  
  // Sort sources by reputation
  const sortedSources = allSources
    .map(url => ({ url, ...getSourceInfo(url) }))
    .sort((a, b) => b.reputation - a.reputation);
  
  // Primary source is the most reputable or first published
  const primarySource = sortedSources[0];
  const additionalSources = sortedSources.slice(1);
  
  const escalationScore = (event as any).escalation_score || 5;
  const escalationColor = getEscalationColor(escalationScore);

  const handleCardClick = () => {
    if (onClick) {
      onClick(event);
      analytics.trackEventInteraction(event.id, 'view');
    }
  };

  const handleSourceClick = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(url, '_blank');
    analytics.trackClick('news_source_link', url);
  };

  return (
    <div
      className="bg-gray-800 rounded-lg shadow-lg p-4 hover:bg-gray-750 transition-all duration-200 cursor-pointer group"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
            {event.title}
          </h3>
          {discoveryRound && (
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                discoveryRound === 1 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-purple-500/20 text-purple-400'
              }`}>
                {discoveryRound === 1 ? 'Discovery Round' : 'Deep Search'}
              </span>
              {sourceReliability !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  sourceReliability >= 0.8 
                    ? 'bg-green-500/20 text-green-400' 
                    : sourceReliability >= 0.6
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {(sourceReliability * 100).toFixed(0)}% reliable
                </span>
              )}
            </div>
          )}
        </div>
        {primarySource && (
          <button
            onClick={(e) => handleSourceClick(primarySource.url, e)}
            className="ml-3 p-1 text-gray-400 hover:text-white transition-colors"
            title={`View on ${primarySource.displayName}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        )}
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-3">
        <span>{formatDateCompact(new Date(event.timestamp))}</span>
        <span>•</span>
        <span>{event.country}</span>
        {event.city && (
          <>
            <span>•</span>
            <span>{event.city}</span>
          </>
        )}
        {primarySource && (
          <>
            <span>•</span>
            <span className="text-gray-300 font-medium">{primarySource.displayName}</span>
          </>
        )}
      </div>

      {/* Summary */}
      <p className="text-gray-300 text-sm mb-3 line-clamp-3">
        {event.summary}
      </p>

      {/* Tags and severity */}
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${escalationColor}`}>
            Score: {formatEscalationScore(escalationScore)}
          </span>
          {event.event_type && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300">
              {event.event_type}
            </span>
          )}
          {/* Bias and verification indicators */}
          {/* Temporarily disabled - CompactBiasIndicator component not available
          {event.has_analysis && (
            <CompactBiasIndicator
              biasScore={event.bias_score}
              verificationStatus={event.verification_status}
            />
          )} */}
        </div>
        {event.tags && event.tags.length > 0 && (
          <ExpandableTags
            tags={event.tags}
            maxVisible={3}
            linkBase="/intelligence-center?tag="
            className="mt-2"
          />
        )}
      </div>

      {/* Additional sources */}
      {additionalSources.length > 0 && (
        <div className="border-t border-gray-700 pt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSources(!showSources);
            }}
            className="flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showSources ? (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            +{additionalSources.length} other source{additionalSources.length > 1 ? 's' : ''}
          </button>
          
          {showSources && (
            <div className="mt-2 space-y-1">
              {additionalSources.map((source, index) => (
                <button
                  key={index}
                  onClick={(e) => handleSourceClick(source.url, e)}
                  className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {source.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}