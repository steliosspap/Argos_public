'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Event } from '@/types';
import type { TimelineState } from '@/types/events';
import { formatDateCompact, formatDateTime } from '@/utils/dateUtils';
import { PerformanceMonitor, throttle } from '@/utils/apiUtils';
import StatCard from '@/components/charts/StatCard';
import BarChart from '@/components/charts/BarChart';
import ErrorBoundary from '@/components/ErrorBoundary';

interface EventsTimelineProps {
  events: Event[];
  timelineState: TimelineState;
  onChange: (state: Partial<TimelineState>) => void;
  onDateRangeSelect: (start: Date, end: Date) => void;
}

interface TimelineBin {
  date: Date;
  count: number;
  events: Event[];
  severity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const TIMELINE_INTERVALS = {
  '1D': { label: '1 Day', days: 1, icon: '📅' },
  '1W': { label: '1 Week', days: 7, icon: '📆' },
  '1M': { label: '1 Month', days: 30, icon: '🗓️' },
  '3M': { label: '3 Months', days: 90, icon: '📊' },
} as const;

type TimelineInterval = keyof typeof TIMELINE_INTERVALS;

const SEVERITY_COLORS = {
  low: { color: '#10B981', bg: 'bg-green-500', text: 'text-green-400' },
  medium: { color: '#F59E0B', bg: 'bg-yellow-500', text: 'text-yellow-400' },
  high: { color: '#F97316', bg: 'bg-orange-500', text: 'text-orange-400' },
  critical: { color: '#EF4444', bg: 'bg-red-500', text: 'text-red-400' }
};

const EventsTimeline = memo(function EventsTimeline({
  events,
  timelineState,
  onChange,
  onDateRangeSelect
}: EventsTimelineProps) {
  const [selectedInterval, setSelectedInterval] = useState<TimelineInterval>('1W');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [hoveredBin, setHoveredBin] = useState<TimelineBin | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  // Group events by time intervals
  const timelineBins = useMemo(() => {
    if (events.length === 0) return [];

    const intervalDays = TIMELINE_INTERVALS[selectedInterval].days;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    
    // Find date range
    const dates = events.map(e => new Date(e.timestamp).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    
    // Create bins
    const bins: TimelineBin[] = [];
    const startDate = new Date(Math.floor(minDate / intervalMs) * intervalMs);
    const endDate = new Date(Math.ceil(maxDate / intervalMs) * intervalMs);
    
    for (let current = startDate.getTime(); current <= endDate.getTime(); current += intervalMs) {
      bins.push({
        date: new Date(current),
        count: 0,
        events: [],
        severity: { low: 0, medium: 0, high: 0, critical: 0 }
      });
    }
    
    // Fill bins with events
    events.forEach(event => {
      const eventTime = new Date(event.timestamp).getTime();
      const binIndex = Math.floor((eventTime - startDate.getTime()) / intervalMs);
      
      if (binIndex >= 0 && binIndex < bins.length) {
        bins[binIndex].count++;
        bins[binIndex].events.push(event);
        bins[binIndex].severity[event.severity as keyof typeof bins[0]['severity']]++;
      }
    });
    
    return bins;
  }, [events, selectedInterval]);

  // Animation logic
  useEffect(() => {
    if (!timelineState.isPlaying || timelineBins.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const startTime = timelineBins[0].date.getTime();
    const endTime = timelineBins[timelineBins.length - 1].date.getTime();
    const duration = endTime - startTime;
    const speed = timelineState.playbackSpeed;
    
    let animationStartTime = Date.now();
    let currentProgress = timelineState.currentTime 
      ? (timelineState.currentTime.getTime() - startTime) / duration
      : 0;

    const animate = () => {
      const elapsed = (Date.now() - animationStartTime) * speed;
      const progress = Math.min(currentProgress + elapsed / duration, 1);
      const currentTime = new Date(startTime + progress * duration);
      
      onChange({ currentTime });
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onChange({ isPlaying: false });
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [timelineState.isPlaying, timelineState.playbackSpeed, timelineState.currentTime, timelineBins, onChange]);

  // Handle timeline click and drag
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || timelineBins.length === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    
    setIsDragging(true);
    setDragStart(progress);
    
    // Set current time based on click position
    const startTime = timelineBins[0].date.getTime();
    const endTime = timelineBins[timelineBins.length - 1].date.getTime();
    const currentTime = new Date(startTime + progress * (endTime - startTime));
    
    onChange({ currentTime, isPlaying: false });
  }, [timelineBins, onChange]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current || timelineBins.length === 0) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    
    const startTime = timelineBins[0].date.getTime();
    const endTime = timelineBins[timelineBins.length - 1].date.getTime();
    const currentTime = new Date(startTime + progress * (endTime - startTime));
    
    onChange({ currentTime });
  }, [isDragging, timelineBins, onChange]);

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  // Handle range selection
  const handleRangeSelection = useCallback((startProgress: number, endProgress: number) => {
    if (timelineBins.length === 0) return;
    
    const startTime = timelineBins[0].date.getTime();
    const endTime = timelineBins[timelineBins.length - 1].date.getTime();
    const duration = endTime - startTime;
    
    const rangeStart = new Date(startTime + startProgress * duration);
    const rangeEnd = new Date(startTime + endProgress * duration);
    
    onChange({ 
      selectedRange: { start: rangeStart, end: rangeEnd }
    });
    
    onDateRangeSelect(rangeStart, rangeEnd);
  }, [timelineBins, onChange, onDateRangeSelect]);

  // Get current progress for timeline cursor
  const getCurrentProgress = useCallback(() => {
    if (!timelineState.currentTime || timelineBins.length === 0) return 0;
    
    const startTime = timelineBins[0].date.getTime();
    const endTime = timelineBins[timelineBins.length - 1].date.getTime();
    const currentTime = timelineState.currentTime.getTime();
    
    return Math.max(0, Math.min(1, (currentTime - startTime) / (endTime - startTime)));
  }, [timelineState.currentTime, timelineBins]);

  const maxCount = Math.max(...timelineBins.map(bin => bin.count));

  // Calculate statistics
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const severityCounts = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const last24h = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    const channelCounts = events.reduce((acc, event) => {
      acc[event.channel] = (acc[event.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalEvents, severityCounts, last24h, channelCounts };
  }, [events]);

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-3 md:p-4 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-base md:text-lg font-semibold text-white">Timeline Analysis</h3>
          </div>
          
          {/* Animation controls */}
          <div className="flex items-center space-x-2">
            {/* Speed control */}
            <select
              value={timelineState.playbackSpeed}
              onChange={(e) => onChange({ playbackSpeed: parseFloat(e.target.value) })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
            
            {/* Play/Pause */}
            <button
              onClick={() => onChange({ isPlaying: !timelineState.isPlaying })}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors touch-manipulation"
              disabled={timelineBins.length === 0}
              aria-label={timelineState.isPlaying ? 'Pause' : 'Play'}
            >
              {timelineState.isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            
            {/* Reset */}
            <button
              onClick={() => onChange({ 
                currentTime: null, 
                isPlaying: false, 
                selectedRange: null 
              })}
              className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors touch-manipulation"
              aria-label="Reset timeline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary Statistics - Scrollable on mobile */}
        <div className="mb-3 md:mb-4 -mx-3 md:mx-0">
          <div className="overflow-x-auto px-3 md:px-0">
            <div className="grid grid-cols-4 gap-2 min-w-[320px]">
              <StatCard
                title="Total Events"
                value={stats.totalEvents}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                color="blue"
              />
              <StatCard
                title="Last 24h"
                value={stats.last24h}
                trend={stats.last24h > 0 ? { value: Math.round((stats.last24h / stats.totalEvents) * 100), isPositive: false } : undefined}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="orange"
              />
              <StatCard
                title="Critical"
                value={stats.severityCounts.critical || 0}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
                color="red"
              />
              <StatCard
                title="High"
                value={stats.severityCounts.high || 0}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="orange"
              />
            </div>
          </div>
        </div>
        
        {/* Interval selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <span className="text-xs text-gray-400 hidden sm:inline">Time Interval:</span>
          <div className="flex bg-gray-800 rounded-lg p-1 w-full sm:w-auto">
            {Object.entries(TIMELINE_INTERVALS).map(([key, { label, icon }]) => (
              <button
                key={key}
                onClick={() => setSelectedInterval(key as TimelineInterval)}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 text-xs rounded transition-all flex items-center justify-center sm:justify-start space-x-1 ${
                  selectedInterval === key
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <span className="hidden sm:inline">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Timeline visualization */}
      <div className="flex-1 p-4">
        {timelineBins.length > 0 ? (
          <div className="h-full flex flex-col">
            {/* Chart */}
            <div className="flex-1 relative">
              <div
                ref={timelineRef}
                className="h-full flex items-end space-x-1 cursor-crosshair"
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseUp={handleTimelineMouseUp}
                onMouseLeave={handleTimelineMouseUp}
              >
                {timelineBins.map((bin, index) => (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-end justify-end relative group"
                    onMouseEnter={() => setHoveredBin(bin)}
                    onMouseLeave={() => setHoveredBin(null)}
                  >
                    {/* Bar segments by severity */}
                    <div 
                      className="w-full flex flex-col rounded-t transition-all duration-200 hover:scale-105"
                      style={{ height: `${(bin.count / maxCount) * 100}%` }}
                    >
                      {bin.severity.critical > 0 && (
                        <div 
                          className="bg-red-500 w-full"
                          style={{ height: `${(bin.severity.critical / bin.count) * 100}%` }}
                        />
                      )}
                      {bin.severity.high > 0 && (
                        <div 
                          className="bg-orange-500 w-full"
                          style={{ height: `${(bin.severity.high / bin.count) * 100}%` }}
                        />
                      )}
                      {bin.severity.medium > 0 && (
                        <div 
                          className="bg-yellow-500 w-full"
                          style={{ height: `${(bin.severity.medium / bin.count) * 100}%` }}
                        />
                      )}
                      {bin.severity.low > 0 && (
                        <div 
                          className="bg-green-500 w-full rounded-b"
                          style={{ height: `${(bin.severity.low / bin.count) * 100}%` }}
                        />
                      )}
                    </div>
                    
                    {/* Hover tooltip */}
                    {hoveredBin === bin && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white p-3 rounded-lg shadow-xl text-xs whitespace-nowrap z-10 border border-gray-700"
                      >
                        <div className="font-semibold text-sm mb-2">{formatDateCompact(bin.date)}</div>
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="font-medium">{bin.count} total events</span>
                        </div>
                        <div className="space-y-1">
                          {Object.entries(bin.severity).map(([severity, count]) => 
                            count > 0 && (
                              <div key={severity} className="flex items-center justify-between space-x-3">
                                <div className="flex items-center space-x-1">
                                  <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS].bg}`} />
                                  <span className="capitalize text-gray-300">{severity}</span>
                                </div>
                                <span className="font-medium">{count}</span>
                              </div>
                            )
                          )}
                        </div>
                        {bin.events.length > 0 && bin.events[0].event_classifier && (
                          <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
                            Primary: {bin.events[0].event_classifier[0]}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                ))}
                
                {/* Timeline cursor */}
                {timelineState.currentTime && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-400 pointer-events-none z-10"
                    style={{ left: `${getCurrentProgress() * 100}%` }}
                  >
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-400 rounded-full" />
                  </div>
                )}
                
                {/* Selected range overlay */}
                {timelineState.selectedRange && (
                  <div className="absolute top-0 bottom-0 bg-blue-400/20 pointer-events-none z-5" />
                )}
              </div>
            </div>
            
            {/* X-axis labels */}
            <div className="mt-3 flex justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDateCompact(timelineBins[0]?.date)}</span>
              </div>
              <span className="text-gray-600">→</span>
              <div className="flex items-center space-x-1">
                <span>{formatDateCompact(timelineBins[timelineBins.length - 1]?.date)}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            {/* Enhanced Legend with counts */}
            <div className="mt-4 bg-gray-800 rounded-lg p-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(SEVERITY_COLORS).map(([severity, config]) => {
                  const count = stats.severityCounts[severity] || 0;
                  const percentage = stats.totalEvents > 0 ? Math.round((count / stats.totalEvents) * 100) : 0;
                  return (
                    <div key={severity} className="flex items-center justify-between bg-gray-900 rounded p-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded ${config.bg}`} />
                        <span className="text-xs text-gray-400 capitalize">{severity}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-white">{count}</div>
                        <div className="text-xs text-gray-500">{percentage}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Channel Distribution */}
            {Object.keys(stats.channelCounts).length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Channel Distribution</h4>
                <BarChart
                  data={Object.entries(stats.channelCounts).map(([channel, count]) => ({
                    label: channel,
                    value: count,
                    color: channel === 'arms' ? '#A855F7' : channel === 'news' ? '#3B82F6' : '#6B7280'
                  }))}
                  height={80}
                  orientation="horizontal"
                  showValues={true}
                  animate={true}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No events to display</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

EventsTimeline.displayName = 'EventsTimeline';

// Wrap with error boundary for resilience
const EventsTimelineWithErrorBoundary = (props: EventsTimelineProps) => (
  <ErrorBoundary
    fallback={
      <div className="w-full h-48 bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <h3 className="text-lg font-semibold mb-2">Timeline Failed to Load</h3>
          <p className="text-gray-400">There was an error loading the timeline. Please refresh the page.</p>
        </div>
      </div>
    }
  >
    <EventsTimeline {...props} />
  </ErrorBoundary>
);

EventsTimelineWithErrorBoundary.displayName = 'EventsTimelineWithErrorBoundary';

export default EventsTimelineWithErrorBoundary;