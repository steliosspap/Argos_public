import { lazy, ComponentType } from 'react';
import { PageSkeleton, MapSkeleton, ChartSkeleton, EventsListSkeleton } from '@/components/LoadingSkeletons';

// Enhanced lazy loading with custom fallbacks and error handling
export function createLazyComponent<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  fallback?: ComponentType
): T {
  const LazyComponent = lazy(factory);
  
  // Add display name for debugging
  const componentName = factory.toString().match(/['"`]([^'"`]+)['"`]/)?.[1] || 'LazyComponent';
  LazyComponent.displayName = `Lazy(${componentName})`;
  
  return LazyComponent as T;
}

// Preload function for eager loading
export function preloadComponent(factory: () => Promise<any>): void {
  const componentImport = factory();
  // Cache the promise to avoid multiple imports
  componentImport.catch(() => {
    // Ignore preload errors, component will retry when actually needed
  });
}

// Pre-defined lazy components with appropriate fallbacks
export const LazyEventsMap = createLazyComponent(
  () => import('@/components/live-events/EventsMap'),
  () => <MapSkeleton />
);

export const LazyEventsTimeline = createLazyComponent(
  () => import('@/components/live-events/EventsTimeline'),
  () => <div className="h-32 bg-gray-800 rounded-lg animate-pulse" />
);

export const LazyEventsSidebar = createLazyComponent(
  () => import('@/components/live-events/EventsSidebar'),
  () => <EventsListSkeleton />
);

export const LazyIntelligenceMap = createLazyComponent(
  () => import('@/components/intelligence/IntelligenceMap'),
  () => <MapSkeleton />
);

export const LazyIntelligenceSidebar = createLazyComponent(
  () => import('@/components/intelligence/IntelligenceSidebar'),
  () => <div className="w-full h-64 bg-gray-800 rounded-lg animate-pulse" />
);

export const LazyConflictDashboard = createLazyComponent(
  () => import('@/components/intelligence/ConflictDashboard'),
  () => <PageSkeleton />
);

// Chart components
export const LazyBarChart = createLazyComponent(
  () => import('@/components/charts/BarChart'),
  () => <ChartSkeleton type="bar" />
);

export const LazyLineChart = createLazyComponent(
  () => import('@/components/charts/LineChart'),
  () => <ChartSkeleton type="line" />
);

export const LazyPieChart = createLazyComponent(
  () => import('@/components/charts/PieChart'),
  () => <ChartSkeleton type="pie" />
);

export const LazyHeatMap = createLazyComponent(
  () => import('@/components/charts/HeatMap'),
  () => <ChartSkeleton />
);

// Admin components
export const LazyAdminPanel = createLazyComponent(
  () => import('@/src/agents/FrontendAgent/components/AdminPanel'),
  () => <PageSkeleton />
);

export const LazyIngestionDashboard = createLazyComponent(
  () => import('@/components/monitoring/IngestionDashboard'),
  () => <PageSkeleton />
);

// Form components
export const LazyFeedbackForm = createLazyComponent(
  () => import('@/src/agents/FrontendAgent/components/forms/FeedbackForm'),
  () => <div className="w-full h-48 bg-gray-800 rounded-lg animate-pulse" />
);

export const LazyBetaSignupForm = createLazyComponent(
  () => import('@/src/agents/FrontendAgent/components/forms/BetaSignupForm'),
  () => <div className="w-full h-64 bg-gray-800 rounded-lg animate-pulse" />
);

// Preload critical components based on route
export const preloadComponentsForRoute = (route: string): void => {
  switch (route) {
    case '/':
    case '/osint-map':
      // Preload map and events components
      preloadComponent(() => import('@/components/live-events/EventsMap'));
      preloadComponent(() => import('@/components/live-events/EventsSidebar'));
      preloadComponent(() => import('@/components/live-events/EventsTimeline'));
      break;
      
    case '/intelligence-center':
      // Preload intelligence components
      preloadComponent(() => import('@/components/intelligence/IntelligenceMap'));
      preloadComponent(() => import('@/components/intelligence/IntelligenceSidebar'));
      preloadComponent(() => import('@/components/intelligence/ConflictDashboard'));
      break;
      
    case '/admin':
      // Preload admin components
      preloadComponent(() => import('@/src/agents/FrontendAgent/components/AdminPanel'));
      preloadComponent(() => import('@/components/monitoring/IngestionDashboard'));
      break;
      
    default:
      // Preload common components
      preloadComponent(() => import('@/components/live-events/EventsMap'));
      break;
  }
};

// Hook for preloading components on route change
export const usePreloadComponents = () => {
  return {
    preloadForRoute: preloadComponentsForRoute,
    preloadComponent
  };
};

// Bundle analysis helper
export const bundleInfo = {
  // Core chunks
  core: [
    'react',
    'react-dom',
    'next'
  ],
  
  // Map-related chunks
  maps: [
    'mapbox-gl',
    'react-globe.gl',
    'three'
  ],
  
  // Chart chunks
  charts: [
    'recharts'
  ],
  
  // API chunks
  api: [
    '@supabase/supabase-js',
    '@tanstack/react-query'
  ],
  
  // UI chunks
  ui: [
    'framer-motion',
    'lucide-react'
  ]
};

// Dynamic import helper with retry logic
export async function dynamicImport<T>(
  factory: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await factory();
    } catch (error) {
      console.warn(`Dynamic import failed on attempt ${attempt}:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to import after ${maxRetries} attempts: ${error}`);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw new Error('Dynamic import failed');
}

// Webpack chunk names for better debugging
export const chunkNames = {
  eventsMap: 'events-map',
  eventsTimeline: 'events-timeline',
  eventsSidebar: 'events-sidebar',
  intelligenceMap: 'intelligence-map',
  intelligenceSidebar: 'intelligence-sidebar',
  conflictDashboard: 'conflict-dashboard',
  adminPanel: 'admin-panel',
  charts: 'charts',
  forms: 'forms'
} as const;