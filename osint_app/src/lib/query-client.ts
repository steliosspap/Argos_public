import { QueryClient } from '@tanstack/react-query';

// PERFORMANCE: Centralized React Query configuration for optimal caching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Disable automatic refetch on window focus for performance
      refetchOnWindowFocus: false,
      // Enable refetch on reconnect
      refetchOnReconnect: true,
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  news: ['news'] as const,
  events: ['events'] as const,
  armsDeals: ['arms-deals'] as const,
  analytics: {
    all: ['analytics'] as const,
    regions: ['analytics', 'regions'] as const,
    timeline: ['analytics', 'timeline'] as const,
    topCountries: ['analytics', 'top-countries'] as const,
    intelligence: ['analytics', 'intelligence'] as const,
  },
} as const;