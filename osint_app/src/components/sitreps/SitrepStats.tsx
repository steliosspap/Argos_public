'use client';

import { Event } from '@/types';
import { useEffect, useState } from 'react';

interface SitrepStatsProps {
  events: Event[];
}

export default function SitrepStats({ events }: SitrepStatsProps) {
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    avgReliability: 0,
    topCountry: '',
    last24h: 0
  });

  useEffect(() => {
    if (events.length === 0) return;

    const severityCounts = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgReliability = events.reduce((sum, event) => 
      sum + (event.reliability || 7), 0) / events.length;

    const countryCounts = events.reduce((acc, event) => {
      acc[event.country] = (acc[event.country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCountry = Object.entries(countryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    const last24h = events.filter(event => {
      const eventDate = new Date(event.timestamp);
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return eventDate >= dayAgo;
    }).length;

    setStats({
      total: events.length,
      critical: severityCounts.critical || 0,
      high: severityCounts.high || 0,
      medium: severityCounts.medium || 0,
      low: severityCounts.low || 0,
      avgReliability,
      topCountry,
      last24h
    });
  }, [events]);

  const StatCard = ({ label, value, color = 'text-white', subtext }: any) => (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <StatCard 
            label="Total SITREPs" 
            value={stats.total}
            subtext="Last 30 days"
          />
          <StatCard 
            label="Critical" 
            value={stats.critical}
            color="text-red-500"
          />
          <StatCard 
            label="High" 
            value={stats.high}
            color="text-orange-500"
          />
          <StatCard 
            label="Medium" 
            value={stats.medium}
            color="text-yellow-500"
          />
          <StatCard 
            label="Low" 
            value={stats.low}
            color="text-blue-500"
          />
          <StatCard 
            label="Avg Confidence" 
            value={stats.avgReliability.toFixed(1)}
            subtext="/10"
          />
          <StatCard 
            label="Hot Zone" 
            value={stats.topCountry}
            color="text-purple-400"
          />
          <StatCard 
            label="Last 24h" 
            value={stats.last24h}
            color="text-green-400"
            subtext="New events"
          />
        </div>

        {/* Severity Distribution Bar */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">Severity Distribution</div>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {stats.critical > 0 && (
              <div 
                className="bg-red-500 flex items-center justify-center text-xs font-semibold"
                style={{ width: `${(stats.critical / stats.total) * 100}%` }}
              >
                {((stats.critical / stats.total) * 100).toFixed(0)}%
              </div>
            )}
            {stats.high > 0 && (
              <div 
                className="bg-orange-500 flex items-center justify-center text-xs font-semibold"
                style={{ width: `${(stats.high / stats.total) * 100}%` }}
              >
                {((stats.high / stats.total) * 100).toFixed(0)}%
              </div>
            )}
            {stats.medium > 0 && (
              <div 
                className="bg-yellow-500 flex items-center justify-center text-xs font-semibold text-black"
                style={{ width: `${(stats.medium / stats.total) * 100}%` }}
              >
                {((stats.medium / stats.total) * 100).toFixed(0)}%
              </div>
            )}
            {stats.low > 0 && (
              <div 
                className="bg-blue-500 flex items-center justify-center text-xs font-semibold"
                style={{ width: `${(stats.low / stats.total) * 100}%` }}
              >
                {((stats.low / stats.total) * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}