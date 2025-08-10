import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Event, ArmsDeal } from '@/types';
import { supabase } from '@/lib/supabase';
import { storage } from '@/utils/storage';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  date: string;
  region: string;
  escalation_score: number;
  tags: string[];
}

export interface FilterOptions {
  timeRange?: string;
  severityFilter?: string;
  searchQuery?: string;
  tagFilter?: string | null;
  region?: string | null;
  country?: string | null;
}

interface UseIntelligenceDataReturn {
  rawEvents: Event[];
  filteredEvents: Event[];
  armsDeals: ArmsDeal[];
  news: NewsItem[];
  loading: boolean;
  isInitialLoad: boolean;
  error: string | null;
  hasNextPage: boolean;
  loadNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
  lastUpdateTime: Date | null;
  totalEventCount: number;
  setFilters: (filters: FilterOptions) => void;
  filters: FilterOptions;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
}

const EVENTS_PER_PAGE = 500;
const INITIAL_LOAD_LIMIT = 1000;
const REFRESH_INTERVAL = 120000; // 2 minutes for auto-refresh
const MANUAL_REFRESH_INTERVAL = 300000; // 5 minutes for background updates

// Utility function to check if event is within time range
function isWithinTimeRange(timestamp: string, timeRange: string): boolean {
  const eventDate = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - eventDate.getTime();
  const hours = diff / (1000 * 60 * 60);
  const days = hours / 24;
  
  switch (timeRange) {
    case '1h': return hours <= 1;
    case '24h': return hours <= 24;
    case '7d': return days <= 7;
    case '30d': return days <= 30;
    case '90d': return days <= 90;
    case 'all': return true;
    default: return days <= 30;
  }
}

// Deep comparison utility for filter options
function areFiltersEqual(a: FilterOptions, b: FilterOptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useIntelligenceData(): UseIntelligenceDataReturn {
  // Use the centralized Supabase client to avoid multiple instances
  
  // Raw data states
  const [rawEvents, setRawEvents] = useState<Event[]>([]);
  const [armsDeals, setArmsDeals] = useState<ArmsDeal[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states
  const [hasNextPage, setHasNextPage] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalEventCount, setTotalEventCount] = useState(0);
  
  // Metadata
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  
  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: '30d',
    severityFilter: 'all',
    searchQuery: '',
    tagFilter: null,
    region: null,
    country: null
  });
  
  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    // Load preference from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('autoRefreshEnabled');
      return stored !== null ? stored === 'true' : true; // Default to enabled
    }
    return true;
  });
  
  // Refs for preventing duplicate operations
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout>();
  const previousFiltersRef = useRef<FilterOptions>(filters);
  const lastFilteredEventsRef = useRef<Event[]>([]);
  const fetchInProgressRef = useRef(false);

  // Memoized filtered events with stable reference
  const filteredEvents = useMemo(() => {
    const startTime = performance.now();
    
    // Check if filters have actually changed
    if (areFiltersEqual(filters, previousFiltersRef.current) && lastFilteredEventsRef.current.length > 0) {
      // Return the cached filtered results
      return lastFilteredEventsRef.current;
    }
    
    console.log('[Intelligence Data] Applying filters:', {
      timeRange: filters.timeRange,
      severityFilter: filters.severityFilter,
      searchQuery: filters.searchQuery,
      tagFilter: filters.tagFilter,
      region: filters.region,
      country: filters.country,
      rawEventsCount: rawEvents.length
    });
    
    const filtered = rawEvents.filter(event => {
      // Time range filter
      if (filters.timeRange && filters.timeRange !== 'all') {
        if (!isWithinTimeRange(event.timestamp, filters.timeRange)) {
          return false;
        }
      }
      
      // Severity filter
      if (filters.severityFilter && filters.severityFilter !== 'all') {
        const eventSeverity = (event as any).severity || 'medium';
        if (eventSeverity !== filters.severityFilter) {
          return false;
        }
      }
      
      // Search query filter
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const searchableText = [
          event.title,
          event.summary,
          event.country,
          event.region,
          ...(event.event_classifier || [])
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(query)) {
          return false;
        }
      }
      
      // Tag filter
      if (filters.tagFilter) {
        const eventTags = event.event_classifier || [];
        if (!eventTags.includes(filters.tagFilter)) {
          return false;
        }
      }
      
      // Region filter
      if (filters.region && event.region !== filters.region) {
        return false;
      }
      
      // Country filter
      if (filters.country && event.country !== filters.country) {
        return false;
      }
      
      return true;
    });
    
    const endTime = performance.now();
    console.log(`[Intelligence Data] Filtering completed in ${(endTime - startTime).toFixed(2)}ms: ${rawEvents.length} → ${filtered.length} events`);
    
    // Update refs for next comparison
    previousFiltersRef.current = { ...filters };
    lastFilteredEventsRef.current = filtered;
    
    return filtered;
  }, [rawEvents, filters]);

  // Enhanced deduplication function
  const deduplicateEvents = useCallback((events: Event[]): Event[] => {
    const seen = new Map<string, Event>();
    const seenTitles = new Map<string, { event: Event, timestamp: number }>();
    
    events.forEach(event => {
      // First check by ID
      const existingById = seen.get(event.id);
      if (existingById) {
        // Keep the newer version
        if (new Date(event.timestamp) > new Date(existingById.timestamp)) {
          seen.set(event.id, event);
        }
        return;
      }
      
      // Check for similar titles within 2 hours
      const eventTime = new Date(event.timestamp).getTime();
      const titleLower = (event.title || '').toLowerCase().trim();
      let isDuplicate = false;
      
      if (titleLower) {
        for (const [seenTitle, { timestamp }] of seenTitles.entries()) {
          const timeDiff = Math.abs(eventTime - timestamp) / (1000 * 60 * 60); // hours
          if (timeDiff < 2) {
            // Simple similarity check
            const similarity = calculateTitleSimilarity(titleLower, seenTitle);
            if (similarity > 0.8) {
              isDuplicate = true;
              break;
            }
          }
        }
      }
      
      if (!isDuplicate) {
        seen.set(event.id, event);
        if (titleLower) {
          seenTitles.set(titleLower, { event, timestamp: eventTime });
        }
      }
    });
    
    const deduped = Array.from(seen.values());
    if (events.length !== deduped.length) {
      console.log(`[Intelligence Data] Deduplication: ${events.length} → ${deduped.length} (removed ${events.length - deduped.length} duplicates)`);
    }
    return deduped;
  }, []);

  // Title similarity calculation
  const calculateTitleSimilarity = (str1: string, str2: string): number => {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  };

  // Fetch events with deduplication and proper state management
  const fetchEvents = useCallback(async (reset = false, isUpdate = false) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('[Intelligence Data] Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    let hasError = false;
    const fetchTimestamp = new Date().toISOString();
    
    console.log(`[Intelligence Data] Starting fetch - Reset: ${reset}, Update: ${isUpdate}, Time: ${fetchTimestamp}`);
    
    try {
      // Only show loading for initial load or explicit actions
      if (!isUpdate) {
        setLoading(true);
      }
      setError(null);

      const page = reset ? 1 : Math.floor(offset / EVENTS_PER_PAGE) + 1;
      const limit = reset && isInitialLoad ? INITIAL_LOAD_LIMIT : EVENTS_PER_PAGE;
      
      // Fetch events from the API - disable country filtering to show all events
      const response = await fetch(`/api/events?page=${page}&limit=${limit}&filterByCountry=false`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Intelligence Data] Non-JSON response from events API:', text);
        throw new Error('Server returned non-JSON response');
      }
      
      const result = await response.json();
      const eventsData = result.data || [];
      const meta = result.meta || {};
      
      console.log(`[Intelligence Data] Fetch completed at ${fetchTimestamp}:`, {
        received: eventsData.length,
        totalInDB: meta.total || 0,
        hasMore: meta.hasNextPage || false
      });
      
      setTotalEventCount(meta.total || 0);
      setHasNextPage(meta.hasNextPage || false);

      // Transform events data
      const transformedEvents: Event[] = eventsData.map((item: any) => ({
        id: item.id,
        title: item.title || '',
        summary: item.summary || '',
        location: item.location || null,
        country: item.country || '',
        region: item.region || '',
        timestamp: item.timestamp,
        channel: item.channel || '',
        reliability: item.reliability || 5,
        event_classifier: item.event_classifier || [],
        severity: item.severity || 'low',
        source_url: item.source_url || '',
        created_at: item.created_at,
        escalation_score: item.escalation_score || 5,
      }));

      if (reset) {
        const dedupedEvents = deduplicateEvents(transformedEvents);
        setRawEvents(dedupedEvents);
        setOffset(transformedEvents.length);
        console.log(`[Intelligence Data] Reset complete: ${dedupedEvents.length} raw events set`);
      } else {
        setRawEvents(prev => {
          const combined = [...prev, ...transformedEvents];
          const deduped = deduplicateEvents(combined);
          console.log(`[Intelligence Data] Append complete: ${prev.length} + ${transformedEvents.length} → ${deduped.length} events`);
          return deduped;
        });
        setOffset(prev => prev + transformedEvents.length);
      }

      setLastUpdateTime(new Date());
      
    } catch (err) {
      hasError = true;
      console.error('[Intelligence Data] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      
      // Schedule retry for failed updates
      if (isUpdate) {
        console.log('[Intelligence Data] Update failed, retrying in 10 seconds');
        setTimeout(() => {
          fetchEvents(false, true);
        }, 10000);
      }
    } finally {
      fetchInProgressRef.current = false;
      
      if (!isUpdate) {
        setLoading(false);
      }
      
      // Mark initial load as complete after first successful fetch
      if (isInitialLoad && !hasError) {
        setIsInitialLoad(false);
      }
    }
  }, [offset, isInitialLoad, deduplicateEvents]);

  // Fetch arms deals
  const fetchArmsDeals = useCallback(async () => {
    try {
      const response = await fetch('/api/arms-deals', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Intelligence Data] Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }
      
      const result = await response.json();
      const data = result.data || result;
      
      if (Array.isArray(data)) {
        setArmsDeals(data);
        console.log(`[Intelligence Data] Fetched ${data.length} arms deals`);
      } else {
        setArmsDeals([]);
      }
    } catch (err) {
      console.error('[Intelligence Data] Failed to fetch arms deals:', err);
      setArmsDeals([]);
    }
  }, []);

  // Fetch news
  const fetchNews = useCallback(async () => {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      // Add auth token if available
      const authToken = storage.getAuthToken();
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch('/api/news', {
        headers,
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Intelligence Data] Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }
      
      const result = await response.json();
      const data = result.data || [];
      
      if (Array.isArray(data)) {
        setNews(data);
        console.log(`[Intelligence Data] Fetched ${data.length} news items`);
      } else {
        setNews([]);
      }
    } catch (err) {
      console.error('[Intelligence Data] Failed to fetch news:', err);
      setNews([]);
    }
  }, []);

  // Load next page
  const loadNextPage = useCallback(async () => {
    if (!hasNextPage || loading || fetchInProgressRef.current) return;
    await fetchEvents(false, false);
  }, [fetchEvents, hasNextPage, loading]);

  // Refetch all data
  const refetch = useCallback(async (isUpdate = false) => {
    console.log(`[Intelligence Data] Refetching all data - Update: ${isUpdate}`);
    setOffset(0);
    await Promise.all([
      fetchEvents(true, isUpdate),
      fetchArmsDeals(),
      fetchNews()
    ]);
  }, [fetchEvents, fetchArmsDeals, fetchNews]);

  // Initial fetch - run once on mount
  useEffect(() => {
    let mounted = true;
    
    const initialFetch = async () => {
      if (mounted) {
        await refetch(false);
      }
    };
    
    initialFetch();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - run once on mount

  // Update localStorage when autoRefreshEnabled changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoRefreshEnabled', autoRefreshEnabled.toString());
    }
  }, [autoRefreshEnabled]);

  // Set up periodic updates with auto-refresh support
  useEffect(() => {
    // Clear any existing intervals
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }

    // Set up auto-refresh if enabled
    if (autoRefreshEnabled) {
      console.log('[Intelligence Data] Auto-refresh enabled - refreshing every 2 minutes');
      
      autoRefreshIntervalRef.current = setInterval(() => {
        if (!loading && !isInitialLoad && !fetchInProgressRef.current) {
          console.log('[Intelligence Data] Auto-refresh triggered');
          refetch(true);
        }
      }, REFRESH_INTERVAL); // 2 minutes
    } else {
      console.log('[Intelligence Data] Auto-refresh disabled');
    }

    // Set up background updates (every 5 minutes) regardless of auto-refresh
    const jitter = Math.random() * 10000;
    console.log(`[Intelligence Data] Setting up background updates every ${MANUAL_REFRESH_INTERVAL/1000}s with ${Math.round(jitter/1000)}s jitter`);
    
    refreshIntervalRef.current = setInterval(() => {
      if (!loading && !isInitialLoad && !fetchInProgressRef.current && !autoRefreshEnabled) {
        setTimeout(() => {
          console.log('[Intelligence Data] Executing background update');
          refetch(true);
        }, jitter);
      }
    }, MANUAL_REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [loading, isInitialLoad, autoRefreshEnabled]); // Include autoRefreshEnabled

  // Real-time subscription
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.log('[Intelligence Data] Real-time subscription disabled in production');
      return;
    }

    if (!supabase) {
      console.warn('[Intelligence Data] Supabase client not initialized');
      return;
    }

    const channel = supabase
      .channel('intelligence-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          console.log('[Intelligence Data] Real-time: New event inserted');
          if (!fetchInProgressRef.current) {
            refetch(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          console.log('[Intelligence Data] Real-time: Event updated');
          if (!fetchInProgressRef.current) {
            refetch(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Intelligence Data] Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Only set up once

  return {
    rawEvents,
    filteredEvents,
    armsDeals,
    news,
    loading,
    isInitialLoad,
    error,
    hasNextPage,
    loadNextPage,
    refetch,
    lastUpdateTime,
    totalEventCount,
    setFilters,
    filters,
    autoRefreshEnabled,
    setAutoRefreshEnabled
  };
}