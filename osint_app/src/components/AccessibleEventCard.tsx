'use client';

import { motion } from 'framer-motion';
import { Event } from '@/types';
import { formatDateTime } from '@/utils/dateUtils';
import { prefersReducedMotion } from '@/utils/accessibility';
import { formatEventType } from '@/utils/formatUtils';

interface AccessibleEventCardProps {
  event: Event;
  isSelected?: boolean;
  onSelect: (event: Event) => void;
  index?: number;
}

const severityConfig = {
  low: { 
    color: 'text-green-400', 
    bg: 'bg-green-500/10', 
    border: 'border-green-500/20',
    label: 'Low severity'
  },
  medium: { 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/10', 
    border: 'border-yellow-500/20',
    label: 'Medium severity'
  },
  high: { 
    color: 'text-orange-400', 
    bg: 'bg-orange-500/10', 
    border: 'border-orange-500/20',
    label: 'High severity'
  },
  critical: { 
    color: 'text-red-400', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/20',
    label: 'Critical severity'
  },
};

export default function AccessibleEventCard({ 
  event, 
  isSelected = false, 
  onSelect,
  index = 0 
}: AccessibleEventCardProps) {
  const severity = severityConfig[event.severity as keyof typeof severityConfig] || severityConfig.medium;
  const shouldReduceMotion = prefersReducedMotion();
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(event);
    }
  };
  
  return (
    <motion.article
      initial={!shouldReduceMotion ? { opacity: 0, y: 20 } : undefined}
      animate={!shouldReduceMotion ? { opacity: 1, y: 0 } : undefined}
      transition={!shouldReduceMotion ? { duration: 0.3, delay: index * 0.05 } : undefined}
      className={`
        p-4 rounded-lg border cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-blue-900/30 border-blue-500' 
          : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 hover:border-gray-600'
        }
        focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-900
      `}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      aria-label={`${event.title}. ${severity.label}. ${formatDateTime(event.timestamp)}. Click to view details.`}
    >
      {/* Header */}
      <header className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-white font-medium line-clamp-2 mb-1">
            {event.title}
          </h3>
          <div className="flex items-center space-x-3 text-xs text-gray-400">
            <time dateTime={event.timestamp} className="flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span>{formatDateTime(event.timestamp)}</span>
            </time>
            {event.location?.city && (
              <span className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
                <span>{event.location.city}, {event.country}</span>
              </span>
            )}
          </div>
        </div>
        
        <div 
          className={`px-2 py-1 rounded text-xs font-medium ${severity.bg} ${severity.color} ${severity.border} border`}
          role="status"
          aria-label={severity.label}
        >
          {event.severity}
        </div>
      </header>
      
      {/* Summary */}
      {event.summary && (
        <p className="text-sm text-gray-300 mb-3 line-clamp-2">
          {event.summary}
        </p>
      )}
      
      {/* Tags */}
      {event.event_classifier && event.event_classifier.length > 0 && (
        <footer className="flex flex-wrap gap-2">
          <h4 className="sr-only">Event categories</h4>
          <ul className="flex flex-wrap gap-2" role="list">
            {event.event_classifier.slice(0, 3).map((tag, idx) => (
              <li key={idx}>
                <span 
                  className="inline-block px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded"
                  role="note"
                >
                  {formatEventType(tag)}
                </span>
              </li>
            ))}
            {event.event_classifier.length > 3 && (
              <li>
                <span 
                  className="inline-block px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded"
                  role="note"
                  aria-label={`And ${event.event_classifier.length - 3} more categories`}
                >
                  +{event.event_classifier.length - 3} more
                </span>
              </li>
            )}
          </ul>
        </footer>
      )}
      
      {/* Visual selection indicator for keyboard users */}
      {isSelected && (
        <div className="sr-only" aria-live="polite">
          Event selected: {event.title}
        </div>
      )}
    </motion.article>
  );
}