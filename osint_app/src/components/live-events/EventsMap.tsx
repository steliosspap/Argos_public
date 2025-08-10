'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import mapboxgl from 'mapbox-gl';
import { Event } from '@/types';
import type { MapBounds, TimelineState } from '@/types/events';
import { useRealTimeConflictEvents } from '@/hooks/useRealTimeConflictEvents';
import { PerformanceMonitor, throttle } from '@/utils/apiUtils';
import ErrorBoundary from '@/components/ErrorBoundary';
import NonGeolocatedEvents from './NonGeolocatedEvents';

// You'll need to add your Mapbox access token to your environment variables
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface EventsMapProps {
  events: Event[];
  selectedEvent: Event | null;
  onEventSelect: (event: Event) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  timelineState: TimelineState;
  loading: boolean;
}

type FilterMode = 'recent' | 'severity' | 'all';

interface FilterState {
  mode: FilterMode;
  severityThreshold: number;
  eventTypes: string[];
  tags: string[];
}

// Color mapping based on escalation score
const getMarkerColor = (escalationScore: number): string => {
  if (escalationScore >= 7) return '#ef4444'; // Red (7-10)
  if (escalationScore >= 4) return '#f59e0b'; // Yellow (4-6)
  return '#3b82f6'; // Blue (0-3)
};

// Size mapping based on escalation score
const getMarkerSize = (escalationScore: number): number => {
  if (escalationScore >= 7) return 12;
  if (escalationScore >= 4) return 10;
  return 8;
};

const EventsMap = memo(function EventsMap({ 
  events, 
  selectedEvent, 
  onEventSelect, 
  onBoundsChange, 
  timelineState,
  loading 
}: EventsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    mode: 'all',
    severityThreshold: 0,
    eventTypes: [],
    tags: []
  });
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onEventSelectRef = useRef(onEventSelect);
  const performanceMonitor = PerformanceMonitor.getInstance();

  // Use the real-time conflict events hook
  useRealTimeConflictEvents(mapInstance);

  // Update refs to avoid stale closures
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
    onEventSelectRef.current = onEventSelect;
  }, [onBoundsChange, onEventSelect]);

  // Initialize map
  useEffect(() => {
    console.log('🗺️ Map initialization started');
    console.log('Container exists:', !!mapContainer.current);
    console.log('Map already initialized:', !!map.current);
    console.log('Mapbox token:', MAPBOX_ACCESS_TOKEN ? `${MAPBOX_ACCESS_TOKEN.substring(0, 10)}...` : 'NOT SET');
    
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('❌ Mapbox access token is required. Please add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment variables.');
      console.error('Current env vars:', Object.keys(process.env).filter(k => k.includes('MAPBOX')));
      return;
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    console.log('✅ Mapbox token set successfully');

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12', // Changed to streets for better visibility
      center: [30.5, 50.4], // Centered around Eastern Europe (Ukraine)
      zoom: 4,
      projection: 'globe' as any,
      touchZoomRotate: true,
      touchPitch: false, // Disable pitch on mobile for better UX
    });

    map.current.on('load', () => {
      console.log('🌍 Map loaded successfully');
      setMapLoaded(true);
      setMapInstance(map.current);
      
      // Add atmosphere for globe projection
      if (map.current) {
        map.current.setFog({
          color: 'rgb(186, 210, 235)',
          'high-color': 'rgb(36, 92, 223)',
          'horizon-blend': 0.02,
          'space-color': 'rgb(11, 11, 25)',
          'star-intensity': 0.6
        });
        
        // Add a test marker to verify map is working
        const testMarker = new mapboxgl.Marker({ color: '#FF0000', scale: 1.5 })
          .setLngLat([30.5, 50.4])
          .setPopup(new mapboxgl.Popup().setHTML('<h3>Map Center - Ukraine</h3><p>Test marker to verify map is working</p>'))
          .addTo(map.current);
        console.log('🔴 Added test marker at map center');
      }
    });

    // Handle map bounds change with throttling
    const throttledBoundsChange = throttle(() => {
      if (map.current) {
        const bounds = map.current.getBounds();
        if (bounds) {
          onBoundsChangeRef.current({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        }
      }
    }, 250); // Throttle to 250ms

    map.current.on('moveend', throttledBoundsChange);

    map.current.on('error', (e: any) => {
      console.error('❌ Map error:', e);
      if (e.error && e.error.status === 401) {
        console.error('🔐 Invalid Mapbox access token');
      }
    });

    return () => {
      map.current?.remove();
    };
  }, []); // Removed onBoundsChange from dependencies to prevent re-initialization

  // Filter events based on timeline state and filter settings
  const visibleEvents = useMemo(() => {
    let filtered = events;

    // Filter by timeline animation
    if (timelineState.isPlaying && timelineState.currentTime) {
      filtered = filtered.filter(event => 
        new Date(event.timestamp) <= timelineState.currentTime!
      );
    }

    // Filter by timeline selected range
    if (timelineState.selectedRange) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= timelineState.selectedRange!.start && 
               eventDate <= timelineState.selectedRange!.end;
      });
    }

    // Apply filter mode
    if (filterState.mode === 'recent') {
      // Show only events from last 24 hours
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);
      filtered = filtered.filter(event => new Date(event.timestamp) > cutoff);
    } else if (filterState.mode === 'severity') {
      // Filter by severity threshold
      filtered = filtered.filter(event => {
        const escalationScore = (event as any).escalation_score || 5;
        return escalationScore >= filterState.severityThreshold;
      });
    }

    // Filter by event types if any selected
    if (filterState.eventTypes.length > 0) {
      filtered = filtered.filter(event => 
        filterState.eventTypes.includes(event.event_type || '')
      );
    }

    // Filter by tags if any selected
    if (filterState.tags.length > 0) {
      filtered = filtered.filter(event => 
        event.tags?.some(tag => filterState.tags.includes(tag)) || false
      );
    }

    return filtered;
  }, [events, timelineState, filterState]);

  // Debounced marker rendering for performance
  const renderMarkersDebounced = useMemo(
    () => throttle(() => {
      if (!map.current || !mapLoaded) return;

      const endTimer = performanceMonitor.startTimer('renderMarkers');

      // Remove old markers
      Object.values(markersRef.current).forEach(marker => marker.remove());
      markersRef.current = {};

      console.log(`[${new Date().toISOString()}] 🗺️ Rendering ${visibleEvents.length} events on map`);
      
      // Add new markers
      visibleEvents.forEach(event => {
      if (!event.location?.coordinates || event.location.coordinates.length !== 2) {
        console.warn('Event missing coordinates:', event.id);
        return;
      }

      const [lng, lat] = event.location.coordinates;
      // Use escalation score for severity visualization
      const escalationScore = (event as any).escalation_score || 5;
      
      console.log(`📍 Adding marker: ${event.title} at [${lng}, ${lat}] with score ${escalationScore}`);

      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'event-marker';
      markerElement.style.cssText = `
        width: ${getMarkerSize(escalationScore) * 2}px;
        height: ${getMarkerSize(escalationScore) * 2}px;
        background-color: ${getMarkerColor(escalationScore)};
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        position: relative;
        z-index: ${escalationScore};
      `;

      // Add hover effect
      markerElement.addEventListener('mouseenter', () => {
        markerElement.style.transform = 'scale(1.2)';
      });

      markerElement.addEventListener('mouseleave', () => {
        markerElement.style.transform = 'scale(1)';
      });

      // Create popup content
      const popupContent = `
        <div class="bg-gray-900 text-white p-3 rounded-lg max-w-sm">
          <h3 class="font-semibold text-sm mb-2">${event.title}</h3>
          <p class="text-xs text-gray-300 mb-2">${event.summary || 'No summary available'}</p>
          <div class="flex justify-between items-center text-xs text-gray-400">
            <span>${event.country}</span>
            <span>${new Date(event.timestamp).toLocaleDateString()}</span>
          </div>
          <div class="flex justify-between items-center text-xs mt-1">
            <span class="capitalize">${event.severity}</span>
            <span>Score: ${escalationScore.toFixed(1)}</span>
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'event-popup'
      }).setHTML(popupContent);

      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      // Handle marker click
      markerElement.addEventListener('click', () => {
        onEventSelectRef.current(event);
      });

      markersRef.current[event.id] = marker;
    });

    endTimer();
    }, 500), // Debounce to 500ms
    [mapLoaded, performanceMonitor]
  );

  // Render markers function that uses the debounced version
  const renderMarkers = useCallback(() => {
    renderMarkersDebounced();
  }, [renderMarkersDebounced, visibleEvents]);

  // Update markers when events change
  useEffect(() => {
    renderMarkers();
  }, [renderMarkers]);

  // Highlight selected event
  useEffect(() => {
    if (!selectedEvent || !mapLoaded || !map.current) return;

    const marker = markersRef.current[selectedEvent.id];
    if (marker) {
      // Zoom to selected marker
      const [lng, lat] = selectedEvent.location.coordinates;
      map.current.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.current.getZoom(), 8),
        duration: 1000
      });

      // Show popup
      const popup = marker.getPopup();
      if (popup && map.current) {
        popup.addTo(map.current);
      }
    }
  }, [selectedEvent, mapLoaded]);

  // Add clustering for performance (when there are many events)
  useEffect(() => {
    if (!map.current || !mapLoaded || events.length < 100) return;

    // Add clustering source and layer when there are many events
    if (!map.current.getSource('events')) {
      const geojsonData = {
        type: 'FeatureCollection' as const,
        features: events.map(event => ({
          type: 'Feature' as const,
          properties: {
            id: event.id,
            title: event.title,
            escalation_score: (event as any).escalation_score || 0,
            severity: event.severity,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: event.location.coordinates
          }
        }))
      };

      map.current.addSource('events', {
        type: 'geojson',
        data: geojsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      });

      // Add cluster circles
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#3b82f6',
            10,
            '#f59e0b',
            30,
            '#ef4444'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            10,
            20,
            30,
            25
          ]
        }
      });

      // Add cluster count labels
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
    }
  }, [events, mapLoaded]);

  return (
    <div className="relative w-full h-full" role="application" aria-label="Interactive conflict events map">
      <div ref={mapContainer} className="w-full h-full" aria-label="Map showing global conflict events" />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10" role="status" aria-live="polite">
          <div className="bg-gray-800 rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" aria-hidden="true"></div>
            <span className="text-white text-sm">Loading events...</span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="absolute top-4 right-4 z-10 max-w-xs">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg text-white">
          <button
            onClick={() => setFilterExpanded(!filterExpanded)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-700/50 rounded-lg transition-colors"
            aria-expanded={filterExpanded}
          >
            <span className="font-semibold text-sm">Filters ({visibleEvents.length}/{events.length})</span>
            <svg className={`w-4 h-4 transition-transform ${filterExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {filterExpanded && (
            <div className="p-3 border-t border-gray-700 space-y-3">
              {/* Sort mode */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Sort by</label>
                <select
                  value={filterState.mode}
                  onChange={(e) => setFilterState({ ...filterState, mode: e.target.value as FilterMode })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Events</option>
                  <option value="recent">Most Recent (24h)</option>
                  <option value="severity">By Severity</option>
                </select>
              </div>
              
              {/* Severity threshold */}
              {filterState.mode === 'severity' && (
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Minimum Severity: {filterState.severityThreshold}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={filterState.severityThreshold}
                    onChange={(e) => setFilterState({ 
                      ...filterState, 
                      severityThreshold: parseInt(e.target.value) 
                    })}
                    className="w-full"
                  />
                </div>
              )}
              
              {/* Reset filters */}
              <button
                onClick={() => setFilterState({
                  mode: 'all',
                  severityThreshold: 0,
                  eventTypes: [],
                  tags: []
                })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-10" role="group" aria-label="Map controls">
        <button
          onClick={() => map.current?.flyTo({ center: [30.5, 50.4], zoom: 5 })}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 md:p-2 rounded-lg shadow-lg transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          title="Reset view to Eastern Europe"
          aria-label="Reset map view to Eastern Europe"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </button>
        <button
          onClick={() => map.current?.zoomIn()}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 md:p-2 rounded-lg shadow-lg transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={() => map.current?.zoomOut()}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 md:p-2 rounded-lg shadow-lg transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
      </div>

      {/* Legend - Collapsible on mobile */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg text-white text-xs" role="complementary" aria-label="Map legend">
          <button
            onClick={() => setLegendCollapsed(!legendCollapsed)}
            className="md:hidden w-full p-3 flex items-center justify-between hover:bg-gray-700/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            aria-label={legendCollapsed ? "Expand legend" : "Collapse legend"}
            aria-expanded={!legendCollapsed}
            aria-controls="map-legend-content"
          >
            <span className="font-semibold">Legend</span>
            <svg className={`w-4 h-4 transition-transform ${legendCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div 
            className={`${legendCollapsed ? 'hidden md:block' : 'block'} p-3`}
            id="map-legend-content"
          >
            <h4 className="font-semibold mb-2 hidden md:block">Escalation Score</h4>
            <div className="space-y-1" role="list">
              <div className="flex items-center space-x-2" role="listitem">
                <div className="w-3 h-3 bg-blue-500 rounded-full" aria-hidden="true"></div>
                <span>Low severity (0-3)</span>
              </div>
              <div className="flex items-center space-x-2" role="listitem">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" aria-hidden="true"></div>
                <span>Medium severity (4-6)</span>
              </div>
              <div className="flex items-center space-x-2" role="listitem">
                <div className="w-3 h-3 bg-red-500 rounded-full" aria-hidden="true"></div>
                <span>High severity (7-10)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Non-geolocated events sidebar */}
      <NonGeolocatedEvents 
        events={events} 
        onEventSelect={onEventSelect}
      />
    </div>
  );
});

// Comparison function for React.memo
EventsMap.displayName = 'EventsMap';

// Wrap with error boundary for resilience
const EventsMapWithErrorBoundary = (props: EventsMapProps) => (
  <ErrorBoundary
    fallback={
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h3 className="text-lg font-semibold mb-2">Map Failed to Load</h3>
          <p className="text-gray-400">There was an error loading the map. Please refresh the page.</p>
        </div>
      </div>
    }
  >
    <EventsMap {...props} />
  </ErrorBoundary>
);

EventsMapWithErrorBoundary.displayName = 'EventsMapWithErrorBoundary';

export default EventsMapWithErrorBoundary;