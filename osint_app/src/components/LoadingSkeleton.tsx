'use client';

interface LoadingSkeletonProps {
  variant?: 'event' | 'zone' | 'stat' | 'text';
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({ 
  variant = 'text', 
  count = 1, 
  className = '' 
}: LoadingSkeletonProps) {
  const skeletons = Array(count).fill(null);

  if (variant === 'event') {
    return (
      <>
        {skeletons.map((_, index) => (
          <div key={index} className={`bg-gray-900 rounded-lg p-4 animate-pulse ${className}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-6 bg-gray-700 rounded-full w-16"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-700 rounded w-full"></div>
              <div className="h-3 bg-gray-700 rounded w-5/6"></div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="h-3 bg-gray-700 rounded w-1/3"></div>
              <div className="h-3 bg-gray-700 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'zone') {
    return (
      <>
        {skeletons.map((_, index) => (
          <div key={index} className={`bg-gray-900 rounded-lg p-4 animate-pulse ${className}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="h-5 bg-gray-700 rounded w-2/3"></div>
              <div className="h-6 bg-gray-700 rounded w-12"></div>
            </div>
            <div className="space-y-1">
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              <div className="h-3 bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'stat') {
    return (
      <div className={`text-center animate-pulse ${className}`}>
        <div className="h-8 bg-gray-700 rounded w-16 mx-auto mb-1"></div>
        <div className="h-3 bg-gray-700 rounded w-20 mx-auto"></div>
      </div>
    );
  }

  // Default text skeleton
  return (
    <>
      {skeletons.map((_, index) => (
        <div key={index} className={`animate-pulse ${className}`}>
          <div className="h-4 bg-gray-700 rounded w-full"></div>
        </div>
      ))}
    </>
  );
}