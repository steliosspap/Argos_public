'use client';

import { Event } from '@/types';
import { useState } from 'react';

interface SitrepCardProps {
  event: Event;
}

export default function SitrepCard({ event }: SitrepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-500/10';
      case 'high': return 'border-orange-500 bg-orange-500/10';
      case 'medium': return 'border-yellow-500 bg-yellow-500/10';
      case 'low': return 'border-blue-500 bg-blue-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-600 text-white';
      case 'medium': return 'bg-yellow-600 text-black';
      case 'low': return 'bg-blue-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getReliabilityIndicator = (reliability: number) => {
    const percentage = (reliability / 10) * 100;
    return (
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-400">Confidence</span>
        <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">{reliability}/10</span>
      </div>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`border-2 rounded-lg p-4 transition-all duration-200 ${getSeverityColor(event.severity)}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getSeverityBadge(event.severity)}`}>
              {event.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">
              {formatTimestamp(event.timestamp)}
            </span>
          </div>
          <h3 className="text-white font-semibold text-lg leading-tight">
            {event.title}
          </h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Location & Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center space-x-1 text-sm">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-white font-medium">{event.country}</span>
          {event.region && event.region !== 'Unknown' && (
            <span className="text-gray-400">• {event.region}</span>
          )}
        </div>
        {event.event_classifier && event.event_classifier.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.event_classifier.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <p className={`text-gray-300 text-sm leading-relaxed ${!expanded && 'line-clamp-2'}`}>
        {event.summary}
      </p>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
          {/* Reliability Indicator */}
          {getReliabilityIndicator(event.reliability || 7)}
          
          {/* Coordinates */}
          {event.location && event.location.coordinates && (
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-400">Coordinates:</span>
              <code className="text-green-400 bg-gray-800 px-2 py-0.5 rounded">
                {event.location.coordinates[1].toFixed(4)}, {event.location.coordinates[0].toFixed(4)}
              </code>
            </div>
          )}

          {/* Source */}
          {event.source_url && (
            <div className="flex items-start space-x-2">
              <span className="text-gray-400 text-sm">Source:</span>
              <a 
                href={event.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 text-sm truncate flex-1 underline"
              >
                {event.source_url}
              </a>
            </div>
          )}

          {/* Event ID */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-500">ID:</span>
            <code className="text-gray-400">{event.id}</code>
          </div>
        </div>
      )}
    </div>
  );
}