'use client';

import { Event } from '@/types';

interface SitrepTimelineProps {
  events: Event[];
}

export default function SitrepTimeline({ events }: SitrepTimelineProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = formatDate(event.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, Event[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div key={date}>
          <h3 className="text-lg font-semibold text-white mb-4 sticky top-0 bg-gray-950 py-2 z-10">
            {date}
          </h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-700"></div>
            
            {/* Events */}
            <div className="space-y-6">
              {dateEvents.map((event, index) => (
                <div key={event.id} className="relative flex items-start">
                  {/* Timeline dot */}
                  <div className="absolute left-8 w-4 h-4 -translate-x-1/2 mt-1">
                    <div className={`w-4 h-4 rounded-full ${getSeverityColor(event.severity)} animate-pulse`}></div>
                  </div>
                  
                  {/* Time */}
                  <div className="w-20 text-right pr-4 pt-0.5">
                    <span className="text-sm text-gray-400">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 ml-8 bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${getSeverityColor(event.severity)}`}>
                            {event.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {event.country} {event.region && `• ${event.region}`}
                          </span>
                        </div>
                        <h4 className="text-white font-medium">
                          {event.title}
                        </h4>
                      </div>
                      <div className="ml-4 flex items-center space-x-1">
                        <div className="w-12 h-1 bg-gray-600 rounded">
                          <div 
                            className="h-full bg-green-500 rounded"
                            style={{ width: `${(event.reliability || 7) * 10}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{event.reliability || 7}/10</span>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm line-clamp-2">
                      {event.summary}
                    </p>
                    {event.event_classifier && event.event_classifier.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {event.event_classifier.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}