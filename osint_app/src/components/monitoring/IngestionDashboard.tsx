'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface IngestionStats {
  period: string;
  newsArticles: number;
  eventsIngested: number;
  conversionRate: string;
  severityBreakdown: Record<string, number>;
  topCountries: { country: string; count: number }[];
  recentEvents: Array<{
    id: string;
    title: string;
    country: string;
    severity: string;
    timestamp: string;
  }>;
}

export default function IngestionDashboard() {
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const supabase = createClientComponentClient();

  const fetchStats = useCallback(async (hours = 24) => {
    setLoading(true);
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);
      
      // Get news articles count
      const { count: newsCount } = await supabase
        .from('news')
        .select('*', { count: 'exact', head: true })
        .gte('published_at', cutoffTime.toISOString());
      
      // Get events count
      const { count: eventsCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', cutoffTime.toISOString())
        .eq('channel', 'news');
      
      // Get recent events
      const { data: recentEvents } = await supabase
        .from('events')
        .select('id, title, country, severity, timestamp')
        .gte('timestamp', cutoffTime.toISOString())
        .eq('channel', 'news')
        .order('timestamp', { ascending: false })
        .limit(10);
      
      // Get severity breakdown
      const { data: severityData } = await supabase
        .from('events')
        .select('severity')
        .gte('timestamp', cutoffTime.toISOString())
        .eq('channel', 'news');
      
      const severityBreakdown = severityData?.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      // Get country breakdown
      const { data: countryData } = await supabase
        .from('events')
        .select('country')
        .gte('timestamp', cutoffTime.toISOString())
        .eq('channel', 'news');
      
      const countryCounts = countryData?.reduce((acc, event) => {
        acc[event.country] = (acc[event.country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const topCountries = Object.entries(countryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([country, count]) => ({ country, count }));
      
      setStats({
        period: `${hours} hours`,
        newsArticles: newsCount || 0,
        eventsIngested: eventsCount || 0,
        conversionRate: newsCount && newsCount > 0 
          ? ((eventsCount || 0) / newsCount * 100).toFixed(1) + '%' 
          : 'N/A',
        severityBreakdown,
        topCountries,
        recentEvents: recentEvents || []
      });
    } catch (error) {
      console.error('Error fetching ingestion stats:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStats(24);
    
    if (autoRefresh) {
      const interval = setInterval(() => fetchStats(24), 60000); // Refresh every minute
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchStats]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading && !stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Ingestion Monitor</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
          <button
            onClick={() => fetchStats(24)}
            className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {stats && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">News Articles</div>
              <div className="text-2xl font-bold text-white">{stats.newsArticles}</div>
              <div className="text-xs text-gray-500">Last {stats.period}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Events Extracted</div>
              <div className="text-2xl font-bold text-white">{stats.eventsIngested}</div>
              <div className="text-xs text-gray-500">From news</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Conversion Rate</div>
              <div className="text-2xl font-bold text-white">{stats.conversionRate}</div>
              <div className="text-xs text-gray-500">News → Events</div>
            </div>
          </div>

          {/* Severity Breakdown */}
          {Object.keys(stats.severityBreakdown).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Severity Distribution</h3>
              <div className="flex space-x-2">
                {['critical', 'high', 'medium', 'low'].map(severity => {
                  const count = stats.severityBreakdown[severity] || 0;
                  const percentage = stats.eventsIngested > 0 
                    ? (count / stats.eventsIngested * 100).toFixed(0) 
                    : 0;
                  
                  return count > 0 ? (
                    <div key={severity} className="flex-1">
                      <div className="text-xs text-gray-400 capitalize">{severity}</div>
                      <div className="flex items-end space-x-1">
                        <div className={`h-8 w-full ${getSeverityColor(severity)} rounded`} 
                             style={{ opacity: percentage ? Number(percentage) / 100 : 0.1 }}></div>
                        <span className="text-xs text-gray-300">{count}</span>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Top Countries */}
          {stats.topCountries.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Top Countries</h3>
              <div className="space-y-1">
                {stats.topCountries.map((item, index) => (
                  <div key={item.country} className="flex justify-between items-center text-sm">
                    <span className="text-gray-300">{index + 1}. {item.country}</span>
                    <span className="text-gray-400">{item.count} events</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Events */}
          {stats.recentEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Recent Events</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {stats.recentEvents.slice(0, 5).map(event => (
                  <div key={event.id} className="text-xs bg-gray-700 rounded p-2">
                    <div className="flex justify-between items-start">
                      <span className="text-gray-300 flex-1 mr-2">{event.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-gray-500">
                      <span>{event.country}</span>
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}