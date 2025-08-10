import { useFetchResource } from './useFetchResource';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  url: string;
  category: string;
  sentiment: number;
  relevance_score: number;
}

interface NewsFilters {
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  source?: string[];
  category?: string[];
  searchQuery?: string;
  minRelevance?: number;
}

/**
 * Hook for fetching news items with filtering and pagination
 * Demonstrates how to use the generic useFetchResource hook
 */
export function useNews(filters: NewsFilters = {}) {
  const buildNewsQuery = (query: any, filters: NewsFilters) => {
    // Date range filter
    if (filters.dateRange?.start) {
      query = query.gte('published_at', filters.dateRange.start.toISOString());
    }
    if (filters.dateRange?.end) {
      query = query.lte('published_at', filters.dateRange.end.toISOString());
    }

    // Source filter
    if (filters.source && filters.source.length > 0) {
      query = query.in('source', filters.source);
    }

    // Category filter
    if (filters.category && filters.category.length > 0) {
      query = query.in('category', filters.category);
    }

    // Search query
    if (filters.searchQuery?.trim()) {
      const searchTerm = filters.searchQuery.trim();
      query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
    }

    // Minimum relevance score
    if (filters.minRelevance !== undefined) {
      query = query.gte('relevance_score', filters.minRelevance);
    }

    return query;
  };

  const result = useFetchResource<NewsItem>({
    resource: 'news',
    filters,
    orderBy: { column: 'published_at', ascending: false },
    pageSize: 20,
    refreshInterval: 60000, // 1 minute
    buildQuery: buildNewsQuery,
    cacheTime: 'fast',
    enableRealtime: true,
    realtimeEvent: 'INSERT'
  });

  // Return with renamed property for consistency
  return {
    news: result.data,
    loading: result.loading,
    error: result.error,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    refetch: result.refetch,
    isStale: result.isStale,
    lastUpdated: result.lastUpdated
  };
}