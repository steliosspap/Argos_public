'use client';

import React, { memo } from 'react';

// Base skeleton component with animation
const SkeletonBase = memo(({ 
  className = '', 
  animate = true 
}: { 
  className?: string; 
  animate?: boolean; 
}) => (
  <div 
    className={`bg-gray-700 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    role="presentation"
    aria-hidden="true"
  />
));

SkeletonBase.displayName = 'SkeletonBase';

// Event card skeleton
export const EventCardSkeleton = memo(() => (
  <div className="bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-700">
    <div className="flex justify-between items-start">
      <SkeletonBase className="h-4 w-3/4" />
      <SkeletonBase className="h-3 w-16 rounded-full" />
    </div>
    <SkeletonBase className="h-3 w-full" />
    <SkeletonBase className="h-3 w-2/3" />
    <div className="flex justify-between items-center pt-2">
      <SkeletonBase className="h-3 w-20" />
      <SkeletonBase className="h-3 w-24" />
    </div>
  </div>
));

EventCardSkeleton.displayName = 'EventCardSkeleton';

// Events list skeleton
export const EventsListSkeleton = memo(({ count = 5 }: { count?: number }) => (
  <div className="space-y-4" role="status" aria-label="Loading events">
    {Array.from({ length: count }, (_, i) => (
      <EventCardSkeleton key={i} />
    ))}
  </div>
));

EventsListSkeleton.displayName = 'EventsListSkeleton';

// Map skeleton
export const MapSkeleton = memo(() => (
  <div className="w-full h-full bg-gray-800 rounded-lg relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 animate-pulse" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <SkeletonBase className="h-4 w-32 mx-auto" />
      </div>
    </div>
    
    {/* Skeleton controls */}
    <div className="absolute top-4 left-4">
      <SkeletonBase className="w-24 h-20 rounded-lg" />
    </div>
    
    <div className="absolute bottom-4 right-4 space-y-2">
      <SkeletonBase className="w-10 h-10 rounded-lg" />
      <SkeletonBase className="w-10 h-10 rounded-lg" />
      <SkeletonBase className="w-10 h-10 rounded-lg" />
    </div>
  </div>
));

MapSkeleton.displayName = 'MapSkeleton';

// Filter panel skeleton
export const FilterPanelSkeleton = memo(() => (
  <div className="bg-gray-800 rounded-lg p-4 space-y-4">
    <SkeletonBase className="h-6 w-20" />
    
    <div className="space-y-3">
      <div>
        <SkeletonBase className="h-4 w-16 mb-2" />
        <SkeletonBase className="h-8 w-full rounded" />
      </div>
      
      <div>
        <SkeletonBase className="h-4 w-20 mb-2" />
        <div className="grid grid-cols-2 gap-2">
          <SkeletonBase className="h-6 w-full rounded-full" />
          <SkeletonBase className="h-6 w-full rounded-full" />
          <SkeletonBase className="h-6 w-full rounded-full" />
          <SkeletonBase className="h-6 w-full rounded-full" />
        </div>
      </div>
      
      <div>
        <SkeletonBase className="h-4 w-24 mb-2" />
        <SkeletonBase className="h-8 w-full rounded" />
      </div>
    </div>
  </div>
));

FilterPanelSkeleton.displayName = 'FilterPanelSkeleton';

// Chart skeleton
export const ChartSkeleton = memo(({ 
  type = 'bar',
  className = 'w-full h-64'
}: { 
  type?: 'bar' | 'line' | 'pie';
  className?: string;
}) => (
  <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
    <SkeletonBase className="h-6 w-32 mb-4" />
    
    {type === 'bar' && (
      <div className="flex items-end justify-between h-40 space-x-2">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonBase 
            key={i} 
            className={`w-8 rounded-t`}
            style={{ height: `${Math.random() * 70 + 30}%` }}
          />
        ))}
      </div>
    )}
    
    {type === 'line' && (
      <div className="h-40 relative">
        <svg className="w-full h-full">
          <path 
            d="M10,150 Q50,100 100,120 T200,80 T300,100"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            className="text-gray-600 animate-pulse"
          />
        </svg>
      </div>
    )}
    
    {type === 'pie' && (
      <div className="flex items-center justify-center h-40">
        <div className="w-32 h-32 rounded-full border-8 border-gray-600 border-t-gray-500 animate-pulse" />
      </div>
    )}
  </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';

// Table skeleton
export const TableSkeleton = memo(({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number; 
  columns?: number; 
}) => (
  <div className="bg-gray-800 rounded-lg overflow-hidden">
    {/* Header */}
    <div className="bg-gray-700 p-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }, (_, i) => (
          <SkeletonBase key={i} className="h-4 w-20" />
        ))}
      </div>
    </div>
    
    {/* Rows */}
    <div className="divide-y divide-gray-700">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }, (_, colIndex) => (
              <SkeletonBase 
                key={colIndex} 
                className={`h-4 ${colIndex === 0 ? 'w-24' : 'w-16'}`} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

// Stats card skeleton
export const StatsCardSkeleton = memo(() => (
  <div className="bg-gray-800 rounded-lg p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <SkeletonBase className="h-4 w-20" />
        <SkeletonBase className="h-8 w-16" />
      </div>
      <SkeletonBase className="w-12 h-12 rounded-lg" />
    </div>
    <div className="mt-4">
      <SkeletonBase className="h-3 w-24" />
    </div>
  </div>
));

StatsCardSkeleton.displayName = 'StatsCardSkeleton';

// Full page skeleton for complex layouts
export const PageSkeleton = memo(() => (
  <div className="min-h-screen bg-gray-900 p-4">
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <SkeletonBase className="h-8 w-48" />
        <SkeletonBase className="h-10 w-32 rounded-lg" />
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>
      
      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MapSkeleton />
        </div>
        <div className="space-y-6">
          <FilterPanelSkeleton />
          <EventsListSkeleton count={3} />
        </div>
      </div>
    </div>
  </div>
));

PageSkeleton.displayName = 'PageSkeleton';

// Loading state wrapper component
export const LoadingWrapper = memo(({ 
  loading, 
  error, 
  children, 
  skeleton,
  className = ''
}: {
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  className?: string;
}) => {
  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Data</h3>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return skeleton || <div className={`animate-pulse ${className}`}>{children}</div>;
  }

  return <>{children}</>;
});

LoadingWrapper.displayName = 'LoadingWrapper';

// Spinner component for inline loading
export const Spinner = memo(({ 
  size = 'md', 
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
  className?: string; 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div 
      className={`${sizeClasses[size]} border-2 border-blue-500 border-t-transparent rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
});

Spinner.displayName = 'Spinner';