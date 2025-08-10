import { useMemo } from 'react';
import { Event } from '@/types';
import { EventFilters, MapBounds, TimelineState } from '@/types/events';
import { useFetchResource } from './useFetchResource';

interface UseEventsProps {
  filters: EventFilters;
  mapBounds: MapBounds | null;
  timelineState: TimelineState;
}

const EVENTS_PER_PAGE = 50;
const REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * Transform raw database event data to our Event interface
 */
const transformEvent = (item: any): Event => {
  // Extract coordinates from PostGIS location with safe handling
  let coordinates: [number, number] = [0, 0];
  
  if (item.location && item.location.coordinates && Array.isArray(item.location.coordinates)) {
    coordinates = [item.location.coordinates[1], item.location.coordinates[0]]; // [lat, lng]
  } else if (item.location && typeof item.location === 'string') {
    // Handle string format like "POINT(lng lat)"
    const match = item.location.match(/POINT\(([^)]+)\)/);
    if (match) {
      const [lng, lat] = match[1].split(' ').map(Number);
      coordinates = [lat, lng];
    }
  }

  return {
    id: item.id,
    title: item.title || '',
    summary: item.summary || '',
    location: {
      type: 'Point' as const,
      coordinates: [coordinates[1], coordinates[0]] // [lng, lat] for GeoJSON
    },
    country: item.country || '',
    region: item.region || '',
    timestamp: item.timestamp,
    channel: item.channel || '',
    reliability: 1, // Default value
    event_classifier: [], // Default empty array
    severity: item.severity || 'low',
    source_url: item.source_url || '',
    created_at: item.created_at,
    escalation_score: item.escalation_score || 0,
  };
};

/**
 * Custom query builder for events with all the specific filtering logic
 */
const buildEventQuery = (query: any, filters: EventFilters, mapBounds: MapBounds | null, timelineState: TimelineState) => {
  // Date range filter
  if (filters.dateRange.start || filters.dateRange.end) {
    if (filters.dateRange.start) {
      query = query.gte('timestamp', filters.dateRange.start.toISOString());
    }
    if (filters.dateRange.end) {
      query = query.lte('timestamp', filters.dateRange.end.toISOString());
    }
  }

  // Timeline state filter
  if (timelineState.selectedRange) {
    query = query
      .gte('timestamp', timelineState.selectedRange.start.toISOString())
      .lte('timestamp', timelineState.selectedRange.end.toISOString());
  } else if (timelineState.isPlaying && timelineState.currentTime) {
    // If timeline is playing, only show events up to current time
    query = query.lte('timestamp', timelineState.currentTime.toISOString());
  }

  // Region filter
  if (filters.region.length > 0) {
    query = query.in('region', filters.region);
  }

  // Country filter
  if (filters.country.length > 0) {
    query = query.in('country', filters.country);
  }

  // Severity filter
  if (filters.severity.length > 0) {
    query = query.in('severity', filters.severity);
  }

  // Channel filter
  if (filters.channel.length > 0) {
    query = query.in('channel', filters.channel);
  }

  // Escalation score range
  if (filters.escalationScore.min > 0 || filters.escalationScore.max < 10) {
    query = query
      .gte('escalation_score', filters.escalationScore.min)
      .lte('escalation_score', filters.escalationScore.max);
  }

  // Search query (full-text search on title and summary)
  if (filters.searchQuery.trim()) {
    const searchTerm = filters.searchQuery.trim();
    query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
  }

  // Geographic bounding box filter (when "only in map frame" is enabled)
  if (filters.onlyInMapFrame && mapBounds) {
    // PostGIS query for points within bounding box
    const { north, south, east, west } = mapBounds;
    query = query.filter('location', 'stbox', `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`);
  }

  return query;
};

export function useEvents({ 
  filters, 
  mapBounds, 
  timelineState 
}: UseEventsProps) {
  // Create combined filters object for the generic hook
  const combinedFilters = useMemo(() => ({
    ...filters,
    mapBounds,
    timelineState
  }), [
    filters.dateRange.start?.toISOString(),
    filters.dateRange.end?.toISOString(),
    filters.region.join(','),
    filters.country.join(','),
    filters.severity.join(','),
    filters.channel.join(','),
    filters.escalationScore.min,
    filters.escalationScore.max,
    filters.searchQuery,
    filters.onlyInMapFrame,
    mapBounds?.north,
    mapBounds?.south,
    mapBounds?.east,
    mapBounds?.west,
    timelineState.isPlaying,
    timelineState.currentTime?.toISOString(),
    timelineState.selectedRange?.start.toISOString(),
    timelineState.selectedRange?.end.toISOString()
  ]);

  // Use the generic fetch resource hook
  const result = useFetchResource<Event>({
    resource: 'events',
    filters: combinedFilters,
    orderBy: { column: 'timestamp', ascending: false },
    pageSize: EVENTS_PER_PAGE,
    refreshInterval: timelineState.isPlaying ? 0 : REFRESH_INTERVAL, // Disable refresh during timeline playback
    transform: (data) => data.map(transformEvent),
    buildQuery: (query, filters: any) => buildEventQuery(query, filters as EventFilters, filters.mapBounds, filters.timelineState),
    cacheTime: 'medium',
    enableRealtime: true,
    realtimeEvent: 'INSERT'
  });

  // Return with renamed property to match existing interface
  return {
    events: result.data,
    loading: result.loading,
    error: result.error,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    refetch: result.refetch,
    isStale: result.isStale,
    lastUpdated: result.lastUpdated
  };
}