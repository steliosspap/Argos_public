'use client';

import { Event } from '@/types';

interface SitrepFiltersProps {
  filters: {
    severity: string;
    country: string;
    eventType: string;
    dateRange: string;
  };
  setFilters: (filters: any) => void;
  events: Event[];
}

export default function SitrepFilters({ filters, setFilters, events }: SitrepFiltersProps) {
  // Extract unique values for filters
  const severities = ['all', 'critical', 'high', 'medium', 'low'];
  
  const countries = ['all', ...Array.from(new Set(events.map(e => e.country)))
    .filter(Boolean)
    .sort()];
  
  const eventTypes = ['all', 'military', 'airstrike', 'protest', 'police', 
    'diplomatic', 'border', 'escalation', 'cyber', 'terror', 'civil_unrest'];

  const dateRanges = [
    { value: 'day', label: 'Last 24 Hours' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' }
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {/* Severity Filter */}
      <select
        value={filters.severity}
        onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
      >
        <option value="all">All Severities</option>
        {severities.slice(1).map(severity => (
          <option key={severity} value={severity}>
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </option>
        ))}
      </select>

      {/* Country Filter */}
      <select
        value={filters.country}
        onChange={(e) => setFilters({ ...filters, country: e.target.value })}
        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
      >
        <option value="all">All Countries</option>
        {countries.slice(1).map(country => (
          <option key={country} value={country}>{country}</option>
        ))}
      </select>

      {/* Event Type Filter */}
      <select
        value={filters.eventType}
        onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
      >
        <option value="all">All Event Types</option>
        {eventTypes.slice(1).map(type => (
          <option key={type} value={type}>
            {type.replace(/_/g, ' ').charAt(0).toUpperCase() + type.replace(/_/g, ' ').slice(1)}
          </option>
        ))}
      </select>

      {/* Date Range Filter */}
      <select
        value={filters.dateRange}
        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
        className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
      >
        {dateRanges.map(range => (
          <option key={range.value} value={range.value}>{range.label}</option>
        ))}
      </select>
    </div>
  );
}