import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { supabaseQueryWithRetry, PerformanceMonitor, debounce } from '@/utils/apiUtils';
import { apiCache, createQueryCacheKey, getCacheTime } from '@/utils/cacheUtils';

export interface ResourceFilters {
  [key: string]: any;
}

export interface FetchResourceOptions<T> {
  resource: string;
  filters?: ResourceFilters;
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
  refreshInterval?: number;
  transform?: (data: any[]) => T[];
  buildQuery?: (query: any, filters: ResourceFilters) => any;
  cacheTime?: 'fast' | 'medium' | 'slow' | 'long';
  enableRealtime?: boolean;
  realtimeEvent?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

export interface UseFetchResourceReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  isStale: boolean;
  lastUpdated: Date | null;
}

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

export function useFetchResource<T = any>({
  resource,
  filters = {},
  orderBy = { column: 'created_at', ascending: false },
  pageSize = DEFAULT_PAGE_SIZE,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  transform,
  buildQuery,
  cacheTime = 'medium',
  enableRealtime = false,
  realtimeEvent = '*'
}: FetchResourceOptions<T>): UseFetchResourceReturn<T> {
  const supabase = createClientComponentClient();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Performance monitoring
  const performanceMonitor = PerformanceMonitor.getInstance();
  
  // Use refs to track dependencies without causing re-renders
  const filtersRef = useRef(filters);
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  
  // Update refs when props change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Generate cache key for current query parameters
  const cacheKey = useMemo(() => {
    return createQueryCacheKey(resource, {
      filters,
      orderBy,
      offset: 0 // Don't include offset in cache key for base query
    });
  }, [resource, JSON.stringify(filters), JSON.stringify(orderBy)]);

  const buildDefaultQuery = useCallback((pageOffset: number) => {
    const currentFilters = filtersRef.current;
    
    let query = supabase
      .from(resource)
      .select('*')
      .order(orderBy.column, { ascending: orderBy.ascending })
      .range(pageOffset, pageOffset + pageSize - 1);

    // Apply custom query builder if provided
    if (buildQuery) {
      query = buildQuery(query, currentFilters);
    } else {
      // Default filter application
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value) && value.length > 0) {
            query = query.in(key, value);
          } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
            query = query.gte(key, value.min).lte(key, value.max);
          } else {
            query = query.eq(key, value);
          }
        }
      });
    }

    return query;
  }, [supabase, resource, orderBy, pageSize, buildQuery]);

  const fetchData = useCallback(async (reset = false, useCache = true) => {
    const endTimer = performanceMonitor.startTimer(`fetch${resource}`);
    
    try {
      setLoading(true);
      setError(null);
      setIsStale(false);

      const pageOffset = reset ? 0 : offset;
      
      // Try cache first for initial load
      if (reset && useCache && pageOffset === 0) {
        const cachedData = apiCache.get(cacheKey);
        if (cachedData) {
          console.log(`📦 Using cached ${resource} data`);
          setData(cachedData.data || []);
          setHasNextPage(cachedData.hasNextPage || false);
          setOffset(cachedData.data?.length || 0);
          setLastUpdated(new Date(cachedData.timestamp));
          setIsStale(Date.now() - cachedData.timestamp > getCacheTime(cacheTime));
          setLoading(false);
          endTimer();
          return;
        }
      }

      // Fetch from database with retry logic
      const result = await supabaseQueryWithRetry(
        () => buildDefaultQuery(pageOffset),
        `Fetch ${resource} (offset: ${pageOffset})`
      );

      if (!result) {
        throw new Error('No data received');
      }

      // Transform the data if transform function provided
      const transformedData: T[] = transform ? transform(result) : result;

      if (reset) {
        setData(transformedData);
        setOffset(transformedData.length);
        
        // Cache the results for faster subsequent loads
        if (pageOffset === 0) {
          apiCache.set(cacheKey, {
            data: transformedData,
            hasNextPage: transformedData.length === pageSize,
            timestamp: Date.now()
          }, getCacheTime(cacheTime));
        }
      } else {
        setData(prev => [...prev, ...transformedData]);
        setOffset(prev => prev + transformedData.length);
      }

      // Check if there are more pages
      setHasNextPage(transformedData.length === pageSize);
      setLastUpdated(new Date());
      setIsStale(false);

    } catch (err) {
      console.error(`❌ Error fetching ${resource}:`, err);
      const errorMessage = err instanceof Error ? err.message : `Failed to fetch ${resource}`;
      setError(errorMessage);
      
      // Try to use stale cache data if available and this was a fresh fetch
      if (reset) {
        const staleData = apiCache.get(cacheKey);
        if (staleData && staleData.data) {
          console.log(`📦 Using stale cached data for ${resource} due to error`);
          setData(staleData.data);
          setHasNextPage(staleData.hasNextPage || false);
          setOffset(staleData.data.length);
          setLastUpdated(new Date(staleData.timestamp));
          setIsStale(true);
          setError(`${errorMessage} (showing cached data)`);
        }
      }
    } finally {
      setLoading(false);
      endTimer();
    }
  }, [buildDefaultQuery, offset, cacheKey, performanceMonitor, resource, pageSize, transform, cacheTime]);

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || loading) return;
    await fetchData(false);
  }, [fetchData, hasNextPage, loading]);

  const refetch = useCallback(async (forceRefresh = false) => {
    console.log(`[${new Date().toISOString()}] ${resource}: Manual refetch triggered${forceRefresh ? ' (force refresh)' : ''}`);
    setOffset(0);
    await fetchData(true, !forceRefresh);
  }, [fetchData, resource]);

  // Debounced refetch to prevent rapid successive calls
  const debouncedRefetch = useMemo(
    () => debounce(() => refetch(false), 300),
    [refetch]
  );

  // Initial fetch only on mount and when key dependencies change
  useEffect(() => {
    let mounted = true;
    let debounceTimer: NodeJS.Timeout;

    // Debounce the fetch to prevent rapid re-fetches
    debounceTimer = setTimeout(() => {
      if (mounted) {
        console.log(`[${new Date().toISOString()}] ${resource}: Fetching due to dependency change`);
        setOffset(0);
        fetchData(true);
      }
    }, 300); // Debounce time for better performance

    return () => {
      mounted = false;
      clearTimeout(debounceTimer);
    };
  }, [cacheKey]); // Use cacheKey as dependency since it includes all filter changes

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Set up new interval for periodic updates
    refreshIntervalRef.current = setInterval(() => {
      // Only refetch if not loading
      if (!loading) {
        debouncedRefetch();
      }
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [debouncedRefetch, loading, refreshInterval]);

  // Set up real-time subscription
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = supabase
      .channel(`${resource}-realtime`)
      .on(
        'postgres_changes',
        {
          event: realtimeEvent,
          schema: 'public',
          table: resource
        },
        (payload) => {
          console.log(`[${new Date().toISOString()}] ${resource} realtime event:`, payload);
          // Invalidate cache and refetch
          apiCache.delete(cacheKey);
          debouncedRefetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, resource, enableRealtime, realtimeEvent, cacheKey, debouncedRefetch]);

  return {
    data,
    loading,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
    isStale,
    lastUpdated
  };
}