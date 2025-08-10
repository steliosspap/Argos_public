'use client';

import React, { useState, useEffect, memo, useCallback } from 'react';
import { PerformanceMonitor } from '@/utils/apiUtils';
import { apiCache, dataCache, logCacheStats } from '@/utils/cacheUtils';
import { serviceWorkerUtils } from '@/utils/serviceWorker';

interface PerformanceMetrics {
  renderTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
  bundleSize: number;
  errorRate: number;
  memoryUsage: number;
}

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

const PerformanceDashboard = memo(({ isVisible, onClose }: PerformanceDashboardProps) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    apiResponseTime: 0,
    cacheHitRate: 0,
    bundleSize: 0,
    errorRate: 0,
    memoryUsage: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [performanceEntries, setPerformanceEntries] = useState<PerformanceEntry[]>([]);

  const refreshMetrics = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      const performanceMonitor = PerformanceMonitor.getInstance();
      
      // Get performance entries
      const entries = performance.getEntriesByType('navigation');
      setPerformanceEntries(entries);
      
      // Calculate metrics
      const apiStats = apiCache.getStats();
      const dataStats = dataCache.getStats();
      const combinedHitRate = (apiStats.hits + dataStats.hits) / 
        Math.max(1, apiStats.hits + apiStats.misses + dataStats.hits + dataStats.misses);
      
      // Memory usage (if available)
      const memoryInfo = (performance as any).memory;
      const memoryUsage = memoryInfo ? 
        Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : 0;
      
      // Bundle size estimation (simplified)
      const bundleSize = entries.length > 0 ? 
        Math.round((entries[0] as PerformanceNavigationTiming).transferSize / 1024) : 0;
      
      // Get performance monitoring data
      const monitoringData = performanceMonitor.getAllMetrics();
      const avgRenderTime = monitoringData.renderMarkers?.avg || 0;
      const avgApiTime = monitoringData.fetchEvents?.avg || 0;
      
      setMetrics({
        renderTime: avgRenderTime,
        apiResponseTime: avgApiTime,
        cacheHitRate: combinedHitRate * 100,
        bundleSize,
        errorRate: 0, // Would need error tracking implementation
        memoryUsage
      });
      
    } catch (error) {
      console.error('Failed to refresh performance metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      refreshMetrics();
      const interval = setInterval(refreshMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isVisible, refreshMetrics]);

  const clearCaches = useCallback(async () => {
    apiCache.clear();
    dataCache.clear();
    
    // Clear service worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    refreshMetrics();
  }, [refreshMetrics]);

  const getMetricColor = (value: number, thresholds: { good: number; fair: number }) => {
    if (value <= thresholds.good) return 'text-green-400';
    if (value <= thresholds.fair) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMetricStatus = (value: number, thresholds: { good: number; fair: number }) => {
    if (value <= thresholds.good) return 'Excellent';
    if (value <= thresholds.fair) return 'Good';
    return 'Needs Improvement';
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Performance Dashboard</h2>
              <p className="text-sm text-gray-400">Real-time application performance metrics</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={refreshMetrics}
              disabled={isRefreshing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Refreshing...</span>
                </div>
              ) : (
                'Refresh'
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Render Performance */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Render Time</h3>
                <span className={`text-xs font-medium ${getMetricColor(metrics.renderTime, { good: 16, fair: 100 })}`}>
                  {getMetricStatus(metrics.renderTime, { good: 16, fair: 100 })}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metrics.renderTime.toFixed(1)}ms
              </div>
              <div className="text-xs text-gray-400">
                Target: &lt;16ms for 60fps
              </div>
            </div>

            {/* API Performance */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">API Response</h3>
                <span className={`text-xs font-medium ${getMetricColor(metrics.apiResponseTime, { good: 200, fair: 1000 })}`}>
                  {getMetricStatus(metrics.apiResponseTime, { good: 200, fair: 1000 })}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metrics.apiResponseTime.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-400">
                Average response time
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Cache Hit Rate</h3>
                <span className={`text-xs font-medium ${getMetricColor(100 - metrics.cacheHitRate, { good: 20, fair: 50 })}`}>
                  {metrics.cacheHitRate > 80 ? 'Excellent' : metrics.cacheHitRate > 50 ? 'Good' : 'Poor'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metrics.cacheHitRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">
                Cache effectiveness
              </div>
            </div>

            {/* Bundle Size */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Bundle Size</h3>
                <span className={`text-xs font-medium ${getMetricColor(metrics.bundleSize, { good: 500, fair: 1000 })}`}>
                  {getMetricStatus(metrics.bundleSize, { good: 500, fair: 1000 })}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metrics.bundleSize}KB
              </div>
              <div className="text-xs text-gray-400">
                Initial page load
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Memory Usage</h3>
                <span className={`text-xs font-medium ${getMetricColor(metrics.memoryUsage, { good: 50, fair: 100 })}`}>
                  {getMetricStatus(metrics.memoryUsage, { good: 50, fair: 100 })}
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metrics.memoryUsage}MB
              </div>
              <div className="text-xs text-gray-400">
                JavaScript heap
              </div>
            </div>

            {/* Error Rate */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Error Rate</h3>
                <span className="text-xs font-medium text-green-400">
                  Excellent
                </span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">
                {metrics.errorRate.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">
                JavaScript errors
              </div>
            </div>
          </div>

          {/* Cache Statistics */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-4">Cache Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">API Cache</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Hits:</span>
                    <span className="text-white">{apiCache.getStats().hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Misses:</span>
                    <span className="text-white">{apiCache.getStats().misses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entries:</span>
                    <span className="text-white">{apiCache.getStats().totalEntries}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Data Cache</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Hits:</span>
                    <span className="text-white">{dataCache.getStats().hits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Misses:</span>
                    <span className="text-white">{dataCache.getStats().misses}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Entries:</span>
                    <span className="text-white">{dataCache.getStats().totalEntries}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-4">Performance Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={clearCaches}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Clear All Caches
              </button>
              <button
                onClick={() => {
                  const monitor = PerformanceMonitor.getInstance();
                  monitor.logPerformanceReport();
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Log Performance Report
              </button>
              <button
                onClick={() => logCacheStats()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Log Cache Stats
              </button>
              <button
                onClick={() => {
                  if (serviceWorkerUtils.getRegistration()) {
                    serviceWorkerUtils.update();
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Update Service Worker
              </button>
            </div>
          </div>

          {/* Performance Recommendations */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-lg font-medium text-white mb-4">Recommendations</h3>
            <div className="space-y-2">
              {metrics.renderTime > 16 && (
                <div className="flex items-start space-x-2 text-sm">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    Render time is high. Consider using React.memo and optimizing re-renders.
                  </span>
                </div>
              )}
              {metrics.apiResponseTime > 1000 && (
                <div className="flex items-start space-x-2 text-sm">
                  <div className="w-4 h-4 bg-red-500 rounded-full mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    API responses are slow. Consider implementing request caching and optimization.
                  </span>
                </div>
              )}
              {metrics.cacheHitRate < 50 && (
                <div className="flex items-start space-x-2 text-sm">
                  <div className="w-4 h-4 bg-orange-500 rounded-full mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    Low cache hit rate. Review caching strategies and TTL settings.
                  </span>
                </div>
              )}
              {metrics.bundleSize > 1000 && (
                <div className="flex items-start space-x-2 text-sm">
                  <div className="w-4 h-4 bg-red-500 rounded-full mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    Large bundle size. Consider code splitting and lazy loading.
                  </span>
                </div>
              )}
              {metrics.memoryUsage > 100 && (
                <div className="flex items-start space-x-2 text-sm">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">
                    High memory usage. Check for memory leaks and optimize data structures.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;