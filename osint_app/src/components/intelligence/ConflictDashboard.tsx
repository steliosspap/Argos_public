'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Event, ArmsDeal, NewsItem } from '@/types';
import { formatRelativeTime, formatDateTime, formatDateCompact } from '@/utils/dateUtils';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/EmptyState';
import StatCard from '@/components/charts/StatCard';
import BarChart from '@/components/charts/BarChart';
import PieChart from '@/components/charts/PieChart';
// import { CompactBiasIndicator } from '@/components/analysis/CompactBiasIndicator'; // Archived feature

interface ConflictZone {
  id: string;
  name: string;
  center: [number, number];
  radius: number;
  escalationScore: number;
  eventCount: number;
  lastUpdated: Date;
}

interface ConflictDashboardProps {
  zone: ConflictZone | null;
  events: Event[];
  allEvents?: Event[]; // For unfiltered severity distribution
  armsDeals: ArmsDeal[];
  news?: NewsItem[];
  activeTab: 'timeline' | 'intelligence' | 'arms' | 'news';
  onTabChange: (tab: 'timeline' | 'intelligence' | 'arms' | 'news') => void;
  onEventSelect: (event: Event) => void;
  isMobile: boolean;
  loading?: boolean;
}

export default function ConflictDashboard({
  zone,
  events,
  allEvents,
  armsDeals,
  news = [],
  activeTab,
  onTabChange,
  onEventSelect,
  isMobile,
  loading = false
}: ConflictDashboardProps) {
  // Debug logging - removed bias analysis logs
  const [isExpanded, setIsExpanded] = useState(false);
  const [displayedEvents, setDisplayedEvents] = useState(20);
  const [displayedNews, setDisplayedNews] = useState(20);
  const [selectedEventForNews, setSelectedEventForNews] = useState<Event | null>(null);
  const EVENTS_PER_PAGE = 20;
  const NEWS_PER_PAGE = 20;
  
  // Reset displayed events and news when zone changes
  useEffect(() => {
    setDisplayedEvents(20);
    setDisplayedNews(20);
    setSelectedEventForNews(null);
  }, [zone?.id]);

  // Function to find related news articles for an event
  const findRelatedNews = (event: Event): string[] => {
    if (!news || news.length === 0) return [];
    
    const relatedNewsIds: string[] = [];
    const eventDate = new Date(event.timestamp);
    const dayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    const dayAfter = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
    
    news.forEach(item => {
      const newsDate = new Date(item.date);
      // Check if news is within 1 day of the event
      if (newsDate >= dayBefore && newsDate <= dayAfter) {
        // Check if news mentions event location, country, or has similar content
        const newsText = `${item.title} ${item.summary || ''}`.toLowerCase();
        
        // Check for location matches
        if (event.country && item.region?.toLowerCase().includes(event.country.toLowerCase())) {
          relatedNewsIds.push(item.id);
        } else if (event.region && item.region?.toLowerCase().includes(event.region.toLowerCase())) {
          relatedNewsIds.push(item.id);
        } else {
          // Check for keyword matches
          const eventKeywords = event.event_classifier || [];
          const hasKeywordMatch = eventKeywords.some(keyword => 
            newsText.includes(keyword.toLowerCase().replace(/_/g, ' '))
          );
          if (hasKeywordMatch) {
            relatedNewsIds.push(item.id);
          }
        }
      }
    });
    
    return relatedNewsIds;
  };

  // Handle arrow click to show related news
  const handleShowRelatedNews = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the event select
    setSelectedEventForNews(event);
    onTabChange('news');
  };

  // Sort events by timestamp (newest first)
  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Generate intelligence summary
  const generateIntelligenceSummary = () => {
    if (!zone || events.length === 0) return [];

    const summaryPoints = [];
    
    // Recent activity
    const last24h = events.filter(e => 
      new Date(e.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    
    if (last24h > 0) {
      summaryPoints.push(`${last24h} events reported in the last 24 hours`);
    }

    // Severity breakdown
    const criticalCount = events.filter(e => e.severity === 'critical').length;
    if (criticalCount > 0) {
      summaryPoints.push(`${criticalCount} critical severity events requiring immediate attention`);
    }

    // Escalation trend
    if (zone.escalationScore >= 7) {
      summaryPoints.push('Escalation score indicates high-intensity conflict activity');
    } else if (zone.escalationScore >= 4) {
      summaryPoints.push('Moderate escalation levels with potential for intensification');
    }

    // Event types
    const eventTypes = events.reduce((acc, event) => {
      if (event.event_classifier?.length) {
        acc[event.event_classifier[0]] = (acc[event.event_classifier[0]] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topEventType = Object.entries(eventTypes)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topEventType) {
      summaryPoints.push(`Primary activity: ${topEventType[0]} (${topEventType[1]} incidents)`);
    }

    // Arms activity
    if (armsDeals.length > 0) {
      const totalValue = armsDeals.reduce((sum, deal) => sum + deal.dealValue, 0);
      summaryPoints.push(`${armsDeals.length} arms transfers valued at $${(totalValue / 1e9).toFixed(1)}B`);
    }

    return summaryPoints.slice(0, 5);
  };


  const formatCurrency = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${(value / 1e3).toFixed(0)}K`;
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'arms':
        return '🔫';
      case 'news':
        return '📰';
      case 'social':
        return '💬';
      default:
        return '📡';
    }
  };

  return (
    <div className={`h-full flex flex-col ${isMobile && isExpanded ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {zone ? zone.name : 'Conflict Intelligence'}
              </h2>
            </div>
            <div className="flex items-center space-x-3">
              {zone && (
                <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${
                  zone.escalationScore >= 7 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  zone.escalationScore >= 4 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Escalation: {zone.escalationScore.toFixed(1)}</span>
                </div>
              )}
              <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="font-medium">{zone ? zone.eventCount : events.length}</span>
                <span>events</span>
              </div>
            </div>
          </div>
          
          {isMobile && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d={isExpanded ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
              </svg>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-3 overflow-x-auto">
          <button
            onClick={() => onTabChange('timeline')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
            }`}
            title="Chronological timeline of conflict events"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Timeline</span>
          </button>
          <button
            onClick={() => onTabChange('intelligence')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              activeTab === 'intelligence'
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Intelligence</span>
          </button>
          <button
            onClick={() => onTabChange('arms')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              activeTab === 'arms'
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 256 256">
              {/* Phosphor Bomb Icon */}
              <path d="M248,32h0a8,8,0,0,0-8,8,52.66,52.66,0,0,1-3.57,17.39C232.38,67.22,225.7,72,216,72c-11.06,0-18.85-9.76-29.49-24.65C176,32.66,164.12,16,144,16c-16.39,0-29,8.89-35.43,25a66.07,66.07,0,0,0-3.9,15H88A16,16,0,0,0,72,72v9.59A88,88,0,0,0,112,248h1.59A88,88,0,0,0,152,81.59V72a16,16,0,0,0-16-16H120.88a46.76,46.76,0,0,1,2.69-9.37C127.62,36.78,134.3,32,144,32c11.06,0,18.85,9.76,29.49,24.65C184,71.34,195.88,88,216,88c16.39,0,29-8.89,35.43-25A68.69,68.69,0,0,0,256,40,8,8,0,0,0,248,32ZM140.8,94a72,72,0,1,1-57.6,0A8,8,0,0,0,88,86.66V72h48V86.66A8,8,0,0,0,140.8,94ZM111.89,209.32A8,8,0,0,1,104,216a8.52,8.52,0,0,1-1.33-.11,57.5,57.5,0,0,1-46.57-46.57,8,8,0,1,1,15.78-2.64,41.29,41.29,0,0,0,33.43,33.43A8,8,0,0,1,111.89,209.32Z"/>
            </svg>
            <span>Arms</span>
          </button>
          <button
            onClick={() => onTabChange('news')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
              activeTab === 'news'
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50'
            }`}
            title="News headlines only"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
            </svg>
            <span>Headlines</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800" style={{ minHeight: 0 }}>
        <AnimatePresence mode="wait">
          {activeTab === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {loading ? (
                <LoadingSkeleton variant="event" count={5} />
              ) : sortedEvents.length === 0 ? (
                <EmptyState
                  icon="document"
                  title="No events found"
                  description={zone 
                    ? "There are no events in this conflict zone matching your current filters."
                    : "There are no events matching your current filters. Try adjusting your filters or selecting a conflict zone."
                  }
                />
              ) : !zone ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Conflict Zone</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Choose a conflict zone from the map or sidebar to view its timeline of events</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline header */}
                  <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {zone.name} Conflict Timeline
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Chronological view of {sortedEvents.length} events • Last updated {formatRelativeTime(zone.lastUpdated)}
                    </p>
                  </div>

                  {/* Timeline visualization */}
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-700"></div>
                    
                    {/* Timeline events */}
                    <div className="space-y-6">
                      {sortedEvents.slice(0, displayedEvents).map((event, index) => {
                        const eventDate = new Date(event.timestamp);
                        const isNewDay = index === 0 || 
                          new Date(sortedEvents[index - 1]?.timestamp).toDateString() !== eventDate.toDateString();
                        
                        return (
                          <div key={event.id}>
                            {/* Date separator */}
                            {isNewDay && (
                              <div className="relative flex items-center mb-4">
                                <div className="absolute left-0 w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-xs font-bold text-white">
                                      {eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                                    </div>
                                    <div className="text-lg font-bold text-white">
                                      {eventDate.getDate()}
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-20 flex-1">
                                  <div className="h-px bg-gray-300 dark:bg-gray-700"></div>
                                </div>
                              </div>
                            )}
                            
                            {/* Event item */}
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="relative flex items-start group"
                            >
                              {/* Timeline dot */}
                              <div className={`absolute left-5 w-6 h-6 rounded-full border-4 border-white dark:border-gray-800 z-10 ${
                                event.severity === 'critical' ? 'bg-red-500' :
                                event.severity === 'high' ? 'bg-orange-500' :
                                event.severity === 'medium' ? 'bg-yellow-500' :
                                'bg-green-500'
                              }`}>
                                <div className="absolute inset-0 rounded-full animate-ping opacity-25 ${
                                  event.severity === 'critical' ? 'bg-red-500' :
                                  event.severity === 'high' ? 'bg-orange-500' :
                                  event.severity === 'medium' ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }"></div>
                              </div>
                              
                              {/* Event content */}
                              <div 
                                className="ml-16 flex-1 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer transition-all hover:shadow-lg"
                                onClick={() => onEventSelect(event)}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        event.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                                        event.severity === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                                        event.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                                        'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                      }`}>
                                        {event.severity}
                                      </span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                      {event.title}
                                    </h4>
                                  </div>
                                </div>
                                
                                {event.summary && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                    {event.summary}
                                  </p>
                                )}
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    {event.location && (
                                      <div className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                        <span>{event.country || event.region || 'Unknown'}</span>
                                      </div>
                                    )}
                                    {event.event_classifier?.length > 0 && (
                                      <span className="text-gray-400">•</span>
                                    )}
                                    {event.event_classifier?.slice(0, 2).map((tag, i) => (
                                      <span key={i} className="text-gray-500">
                                        {tag.replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                    {/* Bias indicator for events - Archived feature */}
                                  </div>
                                  <button
                                    onClick={(e) => handleShowRelatedNews(event, e)}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    title="View related news articles"
                                  >
                                    <svg className="w-4 h-4 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Load more section */}
                    {sortedEvents.length > displayedEvents && (
                      <div className="flex items-center justify-center py-4 mt-6 border-t border-gray-800">
                        <button
                          onClick={() => setDisplayedEvents(prev => prev + EVENTS_PER_PAGE)}
                          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
                        >
                          <span>
                            Showing {Math.min(displayedEvents, sortedEvents.length)} of {sortedEvents.length} events
                          </span>
                          <div className="p-1 rounded-full bg-gray-800 group-hover:bg-gray-700 transition-colors">
                            <svg 
                              className="w-4 h-4" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                      </div>
                    )}
                    
                    {/* Show all loaded message */}
                    {sortedEvents.length <= displayedEvents && sortedEvents.length > EVENTS_PER_PAGE && (
                      <p className="text-center text-gray-500 text-sm py-4 mt-6 border-t border-gray-800">
                        All {sortedEvents.length} events loaded
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'intelligence' && (
            <motion.div
              key="intelligence"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {loading ? (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Conflict Assessment
                    </h3>
                    <LoadingSkeleton variant="text" count={5} className="mb-2" />
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">
                      Last Updated
                    </h3>
                    <LoadingSkeleton variant="text" count={1} />
                  </div>
                </div>
              ) : !zone ? (
                <EmptyState
                  icon="map"
                  title="No zone selected"
                  description="Select a conflict zone from the map or sidebar to view intelligence summary."
                />
              ) : (
                <div className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard
                      title="Total Events"
                      value={zone.eventCount}
                      subtitle={`${events.filter(e => new Date(e.timestamp) > new Date(Date.now() - 24*60*60*1000)).length} in last 24h`}
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      }
                      color="blue"
                    />
                    <StatCard
                      title="Escalation Score"
                      value={zone.escalationScore.toFixed(1)}
                      subtitle={zone.escalationScore >= 7 ? 'High Risk' : zone.escalationScore >= 4 ? 'Moderate' : 'Low Risk'}
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color={zone.escalationScore >= 7 ? 'red' : zone.escalationScore >= 4 ? 'orange' : 'green'}
                    />
                  </div>

                  {/* Severity Distribution */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Severity Distribution</span>
                    </h3>
                    <PieChart
                      data={[
                        { label: 'Critical', value: (allEvents || events).filter(e => e.severity === 'critical').length, color: '#EF4444' },
                        { label: 'High', value: (allEvents || events).filter(e => e.severity === 'high').length, color: '#F97316' },
                        { label: 'Medium', value: (allEvents || events).filter(e => e.severity === 'medium').length, color: '#F59E0B' },
                        { label: 'Low', value: (allEvents || events).filter(e => e.severity === 'low').length, color: '#10B981' }
                      ].filter(d => d.value > 0)}
                      size={160}
                      showLabels={true}
                    />
                  </div>

                  {/* Intelligence Assessment */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Key Intelligence Points</span>
                    </h3>
                    <div className="space-y-2">
                      {generateIntelligenceSummary().map((point, index) => (
                        <motion.div 
                          key={index} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start text-sm bg-gray-100 dark:bg-gray-800 rounded p-2"
                        >
                          <span className="text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0">▸</span>
                          <span className="text-gray-700 dark:text-gray-300">{point}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Event Types */}
                  {events.length > 0 && (
                    <div className="bg-gray-900 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>Event Types</span>
                      </h3>
                      <BarChart
                        data={Object.entries(
                          events.reduce((acc, event) => {
                            if (event.event_classifier?.length) {
                              acc[event.event_classifier[0]] = (acc[event.event_classifier[0]] || 0) + 1;
                            }
                            return acc;
                          }, {} as Record<string, number>)
                        )
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([type, count]) => ({
                            label: type,
                            value: count,
                            color: '#3B82F6'
                          }))}
                        height={120}
                        orientation="horizontal"
                        labelWidth={180}
                      />
                    </div>
                  )}

                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Last Updated</span>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDateTime(zone.lastUpdated)}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'arms' && (
            <motion.div
              key="arms"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {loading ? (
                <LoadingSkeleton variant="event" count={4} />
              ) : armsDeals.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm italic text-gray-500 dark:text-gray-400">
                    No relevant arms transactions
                  </p>
                </div>
              ) : (
                <>
                  {/* Region indicator */}
                  {zone && (
                    <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-500/10 border border-purple-300 dark:border-purple-500/20 rounded-lg">
                      <p className="text-sm text-purple-700 dark:text-purple-400">
                        Showing arms transactions involving <span className="font-semibold">{zone.name}</span>
                      </p>
                    </div>
                  )}
                  
                  {/* Arms Summary Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <StatCard
                      title="Total Deals"
                      value={armsDeals.length}
                      subtitle="Active transfers"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      }
                      color="purple"
                    />
                    <StatCard
                      title="Total Value"
                      value={formatCurrency(armsDeals.reduce((sum, deal) => sum + deal.dealValue, 0))}
                      subtitle="Combined worth"
                      icon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                      color="green"
                    />
                  </div>

                  <div className="space-y-3">
                    {armsDeals.map((deal, index) => (
                      <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 hover:border-purple-400 dark:hover:border-purple-500/30 transition-all shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {deal.weaponSystem || 'Undisclosed Equipment'}
                              </h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                deal.status === 'confirmed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                deal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                'bg-red-500/20 text-red-400 border border-red-500/30'
                              }`}>
                                {deal.status}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-xs text-gray-600 dark:text-gray-400">
                              <div className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>{deal.sellerCountry || deal.sellerCompany}</span>
                              </div>
                              <span>→</span>
                              <div className="flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                                <span className="font-medium">{deal.buyerCountry}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(deal.dealValue)}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-500">
                              {formatDateCompact(deal.date)}
                            </p>
                          </div>
                        </div>
                        
                        {deal.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                            {deal.description}
                          </p>
                        )}
                        
                        {deal.sourceLink && (
                          <div className="flex items-center justify-end text-xs">
                            <a
                              href={deal.sourceLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              <span>View Source</span>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4"
            >
              {loading ? (
                <LoadingSkeleton variant="event" count={6} />
              ) : news.length === 0 ? (
                <EmptyState
                  icon="document"
                  title="No headlines available"
                  description="No news headlines are currently available."
                />
              ) : (
                <div className="space-y-4">
                  {/* Show related event info if navigated from timeline */}
                  {selectedEventForNews && (
                    <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-blue-400 mb-1">
                            Showing news related to event:
                          </p>
                          <p className="text-sm font-medium text-white">
                            {selectedEventForNews.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDateTime(selectedEventForNews.timestamp)} • {selectedEventForNews.country}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedEventForNews(null)}
                          className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                          title="Clear filter"
                        >
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Filter news by zone if selected */}
                  {(() => {
                    // Extract countries from events in this zone for better news matching
                    const zoneCountries = zone ? [...new Set(events.map(e => e.country).filter(Boolean))] : [];
                    
                    const filteredNews = zone ? news.filter(item => {
                      const itemLower = {
                        region: item.region?.toLowerCase() || '',
                        country: (item as any).country?.toLowerCase() || '',
                        title: item.title?.toLowerCase() || '',
                        summary: item.summary?.toLowerCase() || ''
                      };
                      const zoneNameLower = zone.name.toLowerCase();
                      
                      // Check if news matches zone name
                      if (itemLower.region.includes(zoneNameLower) ||
                          itemLower.title.includes(zoneNameLower) ||
                          itemLower.summary.includes(zoneNameLower)) {
                        return true;
                      }
                      
                      // Check if news matches any country from events in this zone
                      return zoneCountries.some(country => 
                        country && (
                          itemLower.country === country.toLowerCase() ||
                          itemLower.title.includes(country.toLowerCase()) ||
                          itemLower.summary.includes(country.toLowerCase())
                        )
                      );
                    }) : news;
                    
                    const relatedNewsIds = selectedEventForNews ? findRelatedNews(selectedEventForNews) : [];
                    
                    // If no news found but we have events, convert events to news format
                    const newsToDisplay = filteredNews.length > 0 ? filteredNews : 
                      (zone && events.length > 0 ? events.slice(0, 20).map(event => ({
                        id: `event-${event.id}`,
                        title: event.title,
                        headline: event.title,
                        summary: event.summary,
                        source: event.channel || 'Event Report',
                        date: event.timestamp,
                        url: event.source_url,
                        region: event.region,
                        tags: event.event_classifier || [],
                        escalation_score: event.escalation_score,
                        // Bias fields archived
                        has_analysis: false,
                        bias_score: undefined,
                        verification_status: undefined
                      } as NewsItem)) : []);
                    
                    return (
                      <>
                        {filteredNews.length === 0 && zone && events.length > 0 && (
                          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <p className="text-sm text-yellow-400">
                              No news articles found for {zone.name}. Showing recent conflict events instead.
                            </p>
                          </div>
                        )}
                        
                        {newsToDisplay.slice(0, displayedNews).map((item, index) => {
                          const isRelated = relatedNewsIds.includes(item.id);
                          
                          // Debug log removed - bias analysis archived
                          
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`rounded-lg p-3 hover:bg-gray-850 transition-all border group cursor-pointer ${
                                isRelated 
                                  ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50' 
                                  : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                              }`}
                              onClick={() => item.url && window.open(item.url, '_blank')}
                            >
                            <div className="flex items-center gap-3">
                              {/* News icon with highlight indicator */}
                              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                isRelated ? 'bg-blue-500/20' : 'bg-blue-500/10'
                              }`}>
                                <svg className={`w-4 h-4 ${isRelated ? 'text-blue-300' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15" />
                                </svg>
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                {/* Headline only */}
                                <h3 className="text-sm font-medium text-white line-clamp-1 group-hover:text-blue-400 transition-colors">
                                  {item.title}
                                </h3>
                                
                                {/* Minimal metadata */}
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  {isRelated && (
                                    <>
                                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">Related</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span>{item.source}</span>
                                  <span>•</span>
                                  <span>{formatRelativeTime(item.date)}</span>
                                  {/* Bias and verification indicators - Archived feature */}
                                </div>
                              </div>
                              
                              {/* Arrow indicator */}
                              <svg className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            </motion.div>
                          );
                        })}
                        
                        {/* Load more section */}
                        {newsToDisplay.length > displayedNews && (
                          <div className="flex items-center justify-center py-4 border-t border-gray-800">
                            <button
                              onClick={() => setDisplayedNews(displayedNews + NEWS_PER_PAGE)}
                              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
                            >
                              <span>
                                Showing {Math.min(displayedNews, newsToDisplay.length)} of {newsToDisplay.length} {filteredNews.length === 0 ? 'events' : 'articles'}
                              </span>
                              <div className="p-1 rounded-full bg-gray-800 group-hover:bg-gray-700 transition-colors">
                                <svg 
                                  className="w-4 h-4" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>
                          </div>
                        )}
                        
                        {/* Show all loaded message */}
                        {newsToDisplay.length <= displayedNews && newsToDisplay.length > NEWS_PER_PAGE && (
                          <p className="text-center text-gray-500 text-sm py-4">
                            All {newsToDisplay.length} {filteredNews.length === 0 ? 'events' : 'articles'} loaded
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}