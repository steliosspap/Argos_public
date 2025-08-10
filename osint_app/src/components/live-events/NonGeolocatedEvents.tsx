'use client';

import { useState } from 'react';
import { Event } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface NonGeolocatedEventsProps {
  events: Event[];
  onEventSelect?: (event: Event) => void;
}

export default function NonGeolocatedEvents({ events, onEventSelect }: NonGeolocatedEventsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Filter events without valid coordinates
  const nonGeolocatedEvents = events.filter(event => {
    if (!event.location?.coordinates || event.location.coordinates.length !== 2) return true;
    const [lng, lat] = event.location.coordinates;
    if (lng === undefined || lat === undefined || lng === null || lat === null) return true;
    if (isNaN(lng) || isNaN(lat)) return true;
    if (lng === 0 || lat === 0) return true;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return true;
    return false;
  });

  // Group events by country
  const eventsByCountry = nonGeolocatedEvents.reduce((acc, event) => {
    const country = event.country || 'Unknown';
    if (!acc[country]) acc[country] = [];
    acc[country].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  const countries = Object.keys(eventsByCountry).sort();
  
  if (nonGeolocatedEvents.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg z-20 max-w-sm">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-white">Unmapped Events</h3>
            <p className="text-xs text-gray-400">{nonGeolocatedEvents.length} events without location</p>
          </div>
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="max-h-96 overflow-y-auto border-t border-gray-800">
          {countries.map(country => (
            <div key={country} className="border-b border-gray-800 last:border-b-0">
              <h4 className="px-3 py-2 text-xs font-semibold text-gray-400 bg-gray-800/50">
                {country} ({eventsByCountry[country].length})
              </h4>
              <div className="divide-y divide-gray-800/50">
                {eventsByCountry[country].slice(0, 5).map(event => (
                  <div
                    key={event.id}
                    className="p-3 hover:bg-gray-800/30 cursor-pointer transition-colors"
                    onClick={() => onEventSelect?.(event)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h5 className="text-sm font-medium text-white line-clamp-2 flex-1">
                        {event.title}
                      </h5>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        event.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        event.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        event.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {event.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-1">
                      {event.summary}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{event.region || 'Unknown region'}</span>
                      <span>{formatDistanceToNow(new Date(event.timestamp))} ago</span>
                    </div>
                  </div>
                ))}
                {eventsByCountry[country].length > 5 && (
                  <p className="px-3 py-2 text-xs text-gray-500 text-center">
                    +{eventsByCountry[country].length - 5} more events
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}