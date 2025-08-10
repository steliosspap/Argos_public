'use client';

import { Event } from '@/types';
import { useState } from 'react';

interface ArgosPulseCardProps {
  event: Event;
  onSelect: () => void;
  isSelected: boolean;
}

export default function ArgosPulseCard({ event, onSelect, isSelected }: ArgosPulseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-gradient-to-r from-red-500/20 to-red-500/10';
      case 'high': return 'border-orange-500 bg-gradient-to-r from-orange-500/20 to-orange-500/10';
      case 'medium': return 'border-yellow-500 bg-gradient-to-r from-yellow-500/20 to-yellow-500/10';
      case 'low': return 'border-blue-500 bg-gradient-to-r from-blue-500/20 to-blue-500/10';
      default: return 'border-gray-500 bg-gradient-to-r from-gray-500/20 to-gray-500/10';
    }
  };

  const getSeverityPulse = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div 
      className={`relative border-l-4 ${getSeverityColor(event.severity)} rounded-r-lg p-3 mb-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      {/* Pulse Indicator */}
      <div className="absolute -left-2 top-3">
        <div className={`w-3 h-3 rounded-full ${getSeverityPulse(event.severity)} animate-pulse`} />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 pr-2">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-semibold text-purple-400">
              ARGOS PULSE
            </span>
            <span className="text-xs text-gray-500">
              •
            </span>
            <span className="text-xs text-gray-400">
              {formatTimestamp(event.timestamp)}
            </span>
            <div className="flex items-center space-x-1">
              <div className="w-8 h-1 bg-gray-700 rounded">
                <div 
                  className="h-full bg-green-500 rounded"
                  style={{ width: `${(event.reliability || 7) * 10}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{event.reliability}/10</span>
            </div>
          </div>
          <h3 className="text-sm font-medium text-white leading-tight">
            {event.title}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Location & Tags */}
      <div className="flex items-center space-x-2 text-xs mb-2">
        <span className="text-gray-300 font-medium">{event.country}</span>
        {event.region && event.region !== 'Unknown' && (
          <>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{event.region}</span>
          </>
        )}
        {event.event_classifier && event.event_classifier.length > 0 && (
          <>
            <span className="text-gray-500">•</span>
            {event.event_classifier.slice(0, 2).map((tag, idx) => (
              <span key={idx} className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">
                {tag}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Summary */}
      <p className={`text-xs text-gray-300 leading-relaxed ${!expanded && 'line-clamp-2'}`}>
        {event.summary}
      </p>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">AI Clustering</span>
            <span className="text-purple-400">Multi-source verified</span>
          </div>
          {event.source_url && (
            <div className="text-xs">
              <a 
                href={event.source_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
                onClick={(e) => e.stopPropagation()}
              >
                View primary source →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}