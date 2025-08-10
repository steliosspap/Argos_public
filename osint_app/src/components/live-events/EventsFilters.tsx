'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EventFilters } from '@/types/events';

interface EventsFiltersProps {
  filters: EventFilters;
  onChange: (filters: Partial<EventFilters>) => void;
  eventCounts: {
    total: number;
    regions: Record<string, number>;
    countries: Record<string, number>;
    severities: Record<string, number>;
    channels: Record<string, number>;
  };
}

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

const REGION_OPTIONS = [
  'Eastern Europe',
  'Western Europe',
  'Middle East',
  'Central Asia',
  'South Asia',
  'East Asia',
  'Southeast Asia',
  'Africa',
  'North America',
  'South America',
];

export default function EventsFilters({ 
  filters, 
  onChange, 
  eventCounts 
}: EventsFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onChange({ searchQuery: searchInput });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput, onChange]);

  const handleDateRangeChange = useCallback((type: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    onChange({
      dateRange: {
        ...filters.dateRange,
        [type]: date,
      }
    });
  }, [filters.dateRange, onChange]);

  const handleMultiSelectChange = useCallback((
    key: keyof EventFilters,
    value: string,
    checked: boolean
  ) => {
    const currentValues = filters[key] as string[];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    onChange({ [key]: newValues });
  }, [filters, onChange]);

  const handleEscalationRangeChange = useCallback((type: 'min' | 'max', value: number) => {
    onChange({
      escalationScore: {
        ...filters.escalationScore,
        [type]: value,
      }
    });
  }, [filters.escalationScore, onChange]);

  const clearAllFilters = useCallback(() => {
    onChange({
      dateRange: { start: null, end: null },
      region: [],
      country: [],
      severity: [],
      channel: [],
      escalationScore: { min: 0, max: 10 },
      searchQuery: '',
      onlyInMapFrame: false,
    });
    setSearchInput('');
  }, [onChange]);

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.region.length > 0) count++;
    if (filters.country.length > 0) count++;
    if (filters.severity.length > 0) count++;
    if (filters.channel.length > 0) count++;
    if (filters.escalationScore.min > 0 || filters.escalationScore.max < 10) count++;
    if (filters.searchQuery.trim()) count++;
    if (filters.onlyInMapFrame) count++;
    return count;
  }, [filters]);

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      {/* Main filter bar */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <input
                type="text"
                placeholder="Search events..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex items-center space-x-2">
            {/* Date range */}
            <div className="flex items-center space-x-1">
              <input
                type="date"
                value={filters.dateRange.start?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleDateRangeChange('start', e.target.value)}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={filters.dateRange.end?.toISOString().split('T')[0] || ''}
                onChange={(e) => handleDateRangeChange('end', e.target.value)}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Map frame toggle */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.onlyInMapFrame}
                onChange={(e) => onChange({ onlyInMapFrame: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-300">Map frame only</span>
            </label>

            {/* Expand button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors text-xs ${
                isExpanded || activeFilterCount > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-medium min-w-[1.25rem] text-center">
                  {activeFilterCount}
                </span>
              )}
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-800 bg-gray-850"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Severity Filter */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Severity</h4>
                <div className="space-y-2">
                  {SEVERITY_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.severity.includes(option.value)}
                        onChange={(e) => handleMultiSelectChange('severity', option.value, e.target.checked)}
                        className="w-3 h-3 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className={`w-2 h-2 rounded-full ${option.color}`} />
                      <span className="text-xs text-gray-300">{option.label}</span>
                      <span className="text-xs text-gray-500">
                        ({eventCounts.severities[option.value] || 0})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Region Filter */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Region</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {REGION_OPTIONS.map((region) => (
                    <label key={region} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.region.includes(region)}
                        onChange={(e) => handleMultiSelectChange('region', region, e.target.checked)}
                        className="w-3 h-3 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-300">{region}</span>
                      <span className="text-xs text-gray-500">
                        ({eventCounts.regions[region] || 0})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Escalation Score Range */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">
                  Escalation Score ({filters.escalationScore.min} - {filters.escalationScore.max})
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">Minimum</label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={filters.escalationScore.min}
                      onChange={(e) => handleEscalationRangeChange('min', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Maximum</label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={filters.escalationScore.max}
                      onChange={(e) => handleEscalationRangeChange('max', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Active Filters Summary */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Active Filters</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Events:</span>
                    <span className="text-white font-medium">{eventCounts.total}</span>
                  </div>
                  {filters.searchQuery && (
                    <div className="text-blue-400">
                      Search: &quot;{filters.searchQuery}&quot;
                    </div>
                  )}
                  {filters.dateRange.start && (
                    <div className="text-blue-400">
                      From: {filters.dateRange.start.toLocaleDateString()}
                    </div>
                  )}
                  {filters.dateRange.end && (
                    <div className="text-blue-400">
                      To: {filters.dateRange.end.toLocaleDateString()}
                    </div>
                  )}
                  {filters.onlyInMapFrame && (
                    <div className="text-blue-400">Map frame only</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}