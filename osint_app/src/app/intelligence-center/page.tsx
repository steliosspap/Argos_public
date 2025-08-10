'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import IntelligenceMap from '@/components/intelligence/IntelligenceMap';
import ConflictDashboard from '@/components/intelligence/ConflictDashboard';
import IntelligenceSidebar from '@/components/intelligence/IntelligenceSidebar';
import MapLayerControls from '@/components/intelligence/MapLayerControls';
import FeedbackPopup from '@/components/FeedbackPopup';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import SearchBar from '@/components/intelligence/SearchBar';
import ErrorState from '@/components/ErrorState';
import Tooltip from '@/components/Tooltip';
import WelcomeModal from '@/components/WelcomeModal';
import HelpButton from '@/components/HelpButton';
import IngestButton from '@/components/IngestButton';
import RealTimeStream from '@/components/RealTimeStream';
import SyncButton from '@/components/SyncButton';
import LoadingProgress from '@/components/LoadingProgress';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import { Event } from '@/types';
import { useIntelligenceData } from '@/hooks/useIntelligenceData';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
// import { useAutoAnalysis } from '@/hooks/useAutoAnalysis'; // Archived feature
import { formatDateCompact } from '@/utils/dateUtils';
import { calculateEscalationScore, getStoredEscalationState, storeEscalationState } from '@/utils/escalationUtils';
import { analytics } from '@/utils/analytics';
import { formatCurrency } from '@/utils/currencyUtils';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
);

interface ConflictZone {
  id: string;
  name: string;
  center: [number, number];
  radius: number; // in km
  escalationScore: number;
  eventCount: number;
  lastUpdated: Date;
}

// Utility function to normalize country names consistently
function normalizeCountryName(country: string): string {
  if (!country) return 'Unknown';
  
  // Special cases for country names
  const specialCases: Record<string, string> = {
    'usa': 'USA',
    'uk': 'UK',
    'uae': 'UAE',
    'united states': 'United States',
    'united kingdom': 'United Kingdom',
    'united arab emirates': 'United Arab Emirates',
    'north korea': 'North Korea',
    'south korea': 'South Korea',
    'south africa': 'South Africa',
    'saudi arabia': 'Saudi Arabia',
    'czech republic': 'Czech Republic',
    'new zealand': 'New Zealand',
    'dr congo': 'DR Congo',
    'central african republic': 'Central African Republic'
  };
  
  const lower = country.trim().toLowerCase();
  if (specialCases[lower]) {
    return specialCases[lower];
  }
  
  // General case - capitalize each word
  return country.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export default function IntelligenceCenterPage() {
  const { isAuthenticated, user, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedZone, setSelectedZone] = useState<ConflictZone | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'intelligence' | 'arms' | 'news'>('timeline');
  const [isMobile, setIsMobile] = useState(false);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30d'); // Changed to 30d to show more events
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [mapLayerStates, setMapLayerStates] = useState({
    events: true,
    arms: false,
    zones: true
  });

  // Use intelligence data hook
  const { 
    rawEvents,
    filteredEvents,
    armsDeals,
    news,
    loading,
    isInitialLoad, 
    error, 
    hasNextPage, 
    loadNextPage,
    refetch,
    lastUpdateTime,
    totalEventCount,
    setFilters,
    filters,
    autoRefreshEnabled,
    setAutoRefreshEnabled
  } = useIntelligenceData();

  // Auto-analyze visible content - Archived feature
  // const { analyzedCount: analyzedNewsCount } = useAutoAnalysis({
  //   items: news || [],
  //   type: 'news',
  //   enabled: false
  // });
  //
  // const { analyzedCount: analyzedEventsCount } = useAutoAnalysis({
  //   items: filteredEvents || [],
  //   type: 'events',
  //   enabled: false
  // });

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      // Track page view
      analytics.trackPageView('intelligence-center');
    }
  }, [isAuthenticated, router]);

  // Handle URL tag parameter
  useEffect(() => {
    const tag = searchParams.get('tag');
    setTagFilter(tag);
  }, [searchParams]);

  // Update filters when local state changes
  useEffect(() => {
    setFilters({
      timeRange,
      severityFilter,
      searchQuery,
      tagFilter,
      region: null,
      country: null
    });
  }, [timeRange, severityFilter, searchQuery, tagFilter, setFilters]);

  // Set up keyboard shortcuts
  const shortcuts = useKeyboardShortcuts([
    {
      key: 'm',
      description: 'Toggle map view',
      action: () => {
        const mapSection = document.querySelector('[data-testid="intelligence-map"]');
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    {
      key: 't',
      description: 'Toggle timeline view',
      action: () => {
        setActiveTab('timeline');
        const dashboard = document.getElementById('conflict-dashboard');
        if (dashboard) {
          dashboard.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    {
      key: 'n',
      description: 'Toggle news view',
      action: () => {
        setActiveTab('news');
        const dashboard = document.getElementById('conflict-dashboard');
        if (dashboard) {
          dashboard.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    {
      key: 'r',
      description: 'Refresh data',
      action: () => {
        refetch();
        analytics.trackClick('keyboard_shortcut', 'refresh_data');
      }
    },
    {
      key: 'f',
      description: 'Toggle filters',
      action: () => {
        // Toggle filter visibility
        const filters = document.querySelector('[data-testid="filters-section"]');
        if (filters) {
          filters.classList.toggle('hidden');
        }
      }
    }
  ]);

  // Check if welcome modal should be shown
  useEffect(() => {
    const checkWelcomeModal = async () => {
      if (!user || !isAuthenticated) return;
      
      // Check localStorage first
      const localShown = typeof window !== 'undefined' ? localStorage.getItem('welcome_modal_shown') : null;
      if (localShown === 'true') return;
      
      try {
        // Check user metadata
        const { data: profile } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('id', user.id)
          .single();
        
        const metadata = profile?.metadata || {};
        if (!metadata.welcome_modal_shown) {
          setShowWelcomeModal(true);
        }
      } catch (error) {
        console.error('Error checking welcome modal status:', error);
        // Show modal if we can't check
        setShowWelcomeModal(true);
      }
    };
    
    checkWelcomeModal();
  }, [user, isAuthenticated]);

  // Handle responsive design
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, sidebar starts closed
      if (mobile && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Process events into conflict zones
  const conflictZones = useCallback((eventsToProcess: Event[]): ConflictZone[] => {
    console.log(`[conflictZones] Processing ${eventsToProcess.length} events`);
    
    // Debug: Check for Middle East events
    const meEvents = eventsToProcess.filter(e => 
      ['Israel', 'Palestine', 'Gaza', 'West Bank'].includes(e.country || '')
    );
    console.log(`[conflictZones] Middle East events: ${meEvents.length}`, 
      meEvents.slice(0, 3).map(e => ({
        country: e.country,
        hasCoords: !!e.location?.coordinates,
        coords: e.location?.coordinates
      }))
    );
    
    // Group events by country only to avoid duplicates
    const countryMap = new Map<string, { events: Event[], centers: [number, number][] }>();
    
    eventsToProcess.forEach(event => {
      if (!event.location?.coordinates || !event.country || event.location.coordinates.length !== 2) {
        if (event.country && ['Gaza', 'Israel', 'Palestine'].includes(event.country)) {
          console.log(`[conflictZones] No coordinates for ${event.country} event`);
        }
        return;
      }
      
      const [lng, lat] = event.location.coordinates;
      
      // Skip events with invalid coordinates
      if (lng === undefined || lat === undefined ||
          lng === null || lat === null ||
          isNaN(lng) || isNaN(lat) || 
          lng < -180 || lng > 180 || 
          lat < -90 || lat > 90) {
        console.log(`[conflictZones] Invalid coords for ${event.country}: [${lng}, ${lat}]`);
        return; // Skip this event entirely
      }
      
      // Normalize country name to avoid duplicates like "United states" vs "United States"
      const normalizedCountry = normalizeCountryName(event.country);
      
      if (!countryMap.has(normalizedCountry)) {
        countryMap.set(normalizedCountry, {
          events: [],
          centers: []
        });
      }
      const data = countryMap.get(normalizedCountry)!;
      data.events.push(event);
      data.centers.push([lng, lat]);
    });

    console.log(`[conflictZones] Countries in map:`, Array.from(countryMap.keys()));
    countryMap.forEach((data, country) => {
      if (['Israel', 'Palestine', 'Gaza'].includes(country)) {
        console.log(`[conflictZones] ${country}: ${data.events.length} events, ${data.centers.length} centers`);
      }
    });

    // Convert to conflict zones
    return Array.from(countryMap.entries())
      .map(([country, data]) => {
        if (data.centers.length === 0) return null; // No valid coordinates
        
        // Get stored escalation state
        const storedState = getStoredEscalationState(country);
        
        // More realistic severity scores
        const severityScores = {
          'critical': 7,  // Reduced from 9
          'high': 5,      // Reduced from 7
          'medium': 3,    // Reduced from 5
          'low': 1        // Reduced from 3
        };
        
        // Calculate time-weighted escalation score
        const escalationState = calculateEscalationScore(storedState, data.events.map(e => {
          // Use severity-based scoring instead of database escalation_score
          const severity = (e as any).severity || 'medium';
          const baseScore = severityScores[severity] || 3;
          
          // Mild boost for recent events
          const hoursSinceEvent = (Date.now() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60);
          const recencyBoost = hoursSinceEvent < 24 ? 1.1 : 1.0;
          
          return {
            escalation_score: baseScore * recencyBoost,
            timestamp: e.timestamp,
            id: e.id
          };
        }));
        
        // Conflict zone adjustments - ONLY for countries directly involved in military action
        const conflictZoneBoosts: Record<string, number> = {
          // Active war zones with direct military engagement
          'Gaza': 1.6,        // Active military operations
          'Israel': 1.5,      // Active military operations
          'Palestine': 1.5,   // Active military operations
          'Ukraine': 1.4,     // Active war with Russia
          'Russia': 1.3,      // Active war with Ukraine
          
          // Active but lower intensity conflicts
          'Syria': 1.2,       // Ongoing civil war
          'Yemen': 1.2,       // Civil war with external involvement
          'Myanmar': 1.1,     // Internal conflict
          
          // High tension areas (but boost should be minimal unless actual conflict)
          'Iran': 1.1,        // Only boost if actual military action
          'Lebanon': 1.1,     // Only boost if actual military action
          'West Bank': 1.1,   // Only boost if actual military action
        };
        
        // Base escalation on event frequency and severity, but handle duplicates
        // Count unique events by timestamp to avoid duplicate inflation
        const uniqueTimestamps = new Set(data.events.map(e => e.timestamp));
        const uniqueEventCount = uniqueTimestamps.size;
        
        const recentEvents = data.events.filter(e => {
          const hours = (Date.now() - new Date(e.timestamp).getTime()) / (1000 * 60 * 60);
          return hours < 168; // Last week
        });
        const uniqueRecentTimestamps = new Set(recentEvents.map(e => e.timestamp));
        const uniqueRecentCount = uniqueRecentTimestamps.size;
        
        // Frequency factor based on unique events to prevent duplicate inflation
        const frequencyFactor = Math.min(1.3, 1 + (uniqueRecentCount / 100));
        
        // Apply zone-specific caps based on actual conflict intensity
        const zoneCaps: Record<string, number> = {
          // Only set high caps for zones with actual military operations
          'Gaza': 9.0,        // Active war zone
          'Israel': 8.5,      // Active military operations
          'Palestine': 8.5,   // Active military operations
          'Ukraine': 8.0,     // Active war
          'Russia': 7.5,      // Active war participant
          
          // Lower caps for other areas
          'Syria': 6.5,       // Ongoing but lower intensity
          'Yemen': 6.5,       // Civil war
          'Myanmar': 6.0,     // Internal conflict
          
          // Default cap for all other countries
          // Political statements or indirect involvement should never exceed 4
        };
        
        const zoneBoost = conflictZoneBoosts[country] || 1.0;
        const rawScore = escalationState.score * zoneBoost * frequencyFactor;
        const zoneCap = zoneCaps[country] || 4.0; // Default cap of 4 for non-conflict zones - political statements/indirect involvement
        
        escalationState.score = Math.min(zoneCap, rawScore);
        
        // Store the new state
        storeEscalationState(country, escalationState);
        
        // Calculate average center from all event locations
        const avgLng = data.centers.reduce((sum, c) => sum + c[0], 0) / data.centers.length;
        const avgLat = data.centers.reduce((sum, c) => sum + c[1], 0) / data.centers.length;
        
        // Final validation of averaged coordinates
        if (isNaN(avgLng) || isNaN(avgLat) || 
            avgLng === 0 || avgLat === 0 ||
            avgLng < -180 || avgLng > 180 || 
            avgLat < -90 || avgLat > 90) {
          console.warn(`Invalid zone center for ${country}:`, { avgLng, avgLat });
          return null;
        }
        
        const zone = {
          id: country,
          name: country,
          center: [avgLng, avgLat] as [number, number],
          radius: 50, // Smaller 50km radius for more focused zones
          escalationScore: escalationState.score,
          eventCount: data.events.length,
          lastUpdated: new Date(Math.max(...data.events.map(e => new Date(e.timestamp).getTime())))
        };
        
        console.log(`Zone created for ${country}:`, { 
          center: zone.center, 
          eventCount: zone.eventCount,
          escalationScore: zone.escalationScore.toFixed(1)
        });
        return zone;
      })
      .filter(zone => zone !== null)
      .filter(zone => {
        // Only show actual conflict zones based on Wikipedia's list
        const conflictCountries = [
          // Major wars (10,000+ deaths)
          'Ukraine', 'Russia', 'Myanmar', 'Sudan', 'South Sudan',
          
          // Wars (1,000-9,999 deaths)
          'Israel', 'Palestine', 'Gaza', 'West Bank', 'Lebanon',
          'Syria', 'Iraq', 'Yemen', 'Somalia', 'Mali', 'Burkina Faso',
          'Nigeria', 'Niger', 'Cameroon', 'Chad', 'Ethiopia',
          'Democratic Republic of Congo', 'DRC', 'Congo',
          'Afghanistan', 'Pakistan', 'Mexico',
          
          // Minor conflicts (100-999 deaths)
          'Libya', 'Egypt', 'Iran', 'Turkey', 'Algeria', 'Tunisia',
          'Central African Republic', 'Mozambique', 'Kenya',
          'Colombia', 'Philippines', 'India', 'Thailand'
        ];
        return conflictCountries.includes(zone.name);
      }) as ConflictZone[]; // Remove null zones and non-conflict countries
      
    const finalZones = zones;
    console.log(`[conflictZones] Final zones:`, finalZones.map(z => ({ name: z.name, events: z.eventCount })));
    return finalZones;
  }, []);

  // Events are now filtered inside the hook

  const zones = conflictZones(filteredEvents);
  
  // Debug zones and events
  console.log(`Intelligence Center: ${filteredEvents.length} filtered events (of ${rawEvents.length} total), ${zones.length} conflict zones`);
  
  // Count events by country
  const countryCounts: Record<string, number> = {};
  rawEvents.forEach(e => {
    const country = e.country || 'Unknown';
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  });
  console.log('Events by country:', countryCounts);
  
  // Debug specific conflict data
  if (rawEvents.length > 0) {
    const gazaEvents = rawEvents.filter(e => 
      e.country?.toLowerCase().includes('gaza') || 
      e.country?.toLowerCase().includes('palestine') ||
      e.title?.toLowerCase().includes('gaza')
    );
    const ukraineEvents = rawEvents.filter(e => 
      e.country?.toLowerCase().includes('ukraine') ||
      e.title?.toLowerCase().includes('ukraine')
    );
    console.log(`Specific conflicts - Gaza: ${gazaEvents.length}, Ukraine: ${ukraineEvents.length}`);
    
    // Log first event from each to check coordinates
    if (gazaEvents.length > 0) {
      console.log('Sample Gaza event:', gazaEvents[0]);
    }
    if (ukraineEvents.length > 0) {
      console.log('Sample Ukraine event:', ukraineEvents[0]);
    }
  }

  // Filter events for selected zone
  const zoneEvents = selectedZone 
    ? filteredEvents.filter(event => normalizeCountryName(event.country) === selectedZone.id)
    : filteredEvents;

  // Filter arms deals for selected zone
  const zoneArmsDeals = selectedZone && armsDeals
    ? armsDeals.filter(deal => {
        // Extract country from zone name (e.g., "Syria, Aleppo" -> "Syria")
        const zoneCountry = selectedZone.name.split(',')[0].trim();
        
        // Check if the deal involves the zone's country as buyer or seller
        return deal.buyerCountry === zoneCountry || 
               deal.sellerCountry === zoneCountry ||
               // Also check for normalized country names
               (deal.buyerCountry && normalizeCountryName(deal.buyerCountry) === normalizeCountryName(zoneCountry)) ||
               (deal.sellerCountry && normalizeCountryName(deal.sellerCountry) === normalizeCountryName(zoneCountry));
      })
    : armsDeals || [];

  const handleZoneSelect = (zone: ConflictZone) => {
    console.log('Zone selected:', zone.name, 'Center:', zone.center);
    setSelectedZone(zone);
    setSelectedEvent(null);
    // Track zone selection
    analytics.trackMapInteraction('zone_select', { 
      zoneName: zone.name, 
      eventCount: zone.eventCount,
      escalationScore: zone.escalationScore 
    });
    // Scroll to dashboard on mobile
    if (isMobile) {
      document.getElementById('conflict-dashboard')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    // Track event selection
    analytics.trackEventInteraction(event.id, 'view');
    // Find the zone this event belongs to - normalize country name
    const normalizedEventCountry = normalizeCountryName(event.country);
    const zone = zones.find(z => z.id === normalizedEventCountry);
    if (zone) {
      setSelectedZone(zone);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Enable natural scrolling on this page
  useEffect(() => {
    // Ensure body can scroll
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    return () => {
      // Reset on unmount
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Skip to content link for screen readers */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded">
        Skip to main content
      </a>
      
      {/* Fixed Header for Mobile */}
      {isMobile && (
        <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-base font-bold text-white truncate">Intelligence Center</h1>
              {totalEventCount > 0 && (
                <span className="text-xs text-gray-400">({totalEventCount} events)</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <SyncButton
                onSync={refetch}
                lastUpdated={lastUpdateTime || new Date()}
                className="scale-90"
              />
              <button
                onClick={() => setShowWelcomeModal(true)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Help"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
          <SearchBar 
            onSearch={setSearchQuery} 
            placeholder="Search events..."
            className="w-full"
          />
        </header>
      )}

      <div className="flex">
        {/* Sidebar - Fixed on desktop, overlay on mobile */}
        <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-40' : 'sticky top-0 h-screen'}`}>
          <IntelligenceSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            selectedZone={selectedZone}
            conflictZones={zones}
            isMobile={isMobile}
            onZoneSelect={handleZoneSelect}
            lastUpdateTime={lastUpdateTime}
            autoRefreshEnabled={autoRefreshEnabled}
            onAutoRefreshToggle={setAutoRefreshEnabled}
          />
        </div>

        {/* Main Content Area - Scrollable */}
        <main id="main-content" className="flex-1 min-h-screen">
          {loading && !rawEvents.length ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <LoadingProgress 
                message="Loading intelligence data..."
                className="max-w-sm"
              />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <ErrorState 
                title="Failed to load intelligence data"
                message={error}
                onRetry={() => window.location.reload()}
              />
            </div>
          ) : (
            <>
              {/* Map Section */}
              <section 
                className={`relative ${isMobile ? 'h-[50vh]' : 'min-h-[80vh]'} bg-gray-100 dark:bg-gray-950`}
                aria-label="Intelligence map"
                data-testid="intelligence-map"
              >
                {/* Map Layer Controls */}
                <div className="absolute top-4 left-4 z-20">
                  <MapLayerControls 
                    onLayerToggle={(layerId, enabled) => {
                      setMapLayerStates(prev => ({ ...prev, [layerId]: enabled }));
                    }}
                  />
                </div>
                <div className="absolute inset-0">
                  <IntelligenceMap
                    events={filteredEvents}
                    conflictZones={zones}
                    selectedZone={selectedZone}
                    selectedEvent={selectedEvent}
                    onZoneSelect={handleZoneSelect}
                    onEventSelect={handleEventSelect}
                    onBoundsChange={setMapBounds}
                    loading={isInitialLoad}
                    armsDeals={armsDeals}
                    layerStates={mapLayerStates}
                  />
                </div>
              </section>

          {/* Welcome Banner - Only show when no zone is selected */}
          {!selectedZone && (
            <section className="bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 border-y border-purple-300 dark:border-purple-800/30 px-6 py-6 mb-4">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unified Intelligence Center</h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Your central hub for real-time global conflict monitoring, arms trade analysis, and geopolitical intelligence
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Live Event Monitoring</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                    <span>News Feed Integration</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Arms Trade Tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>AI-Powered Analysis</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tag Filter Banner */}
          {tagFilter && (
            <section className="bg-blue-900/20 border-b border-blue-800/30 px-4 md:px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="text-sm text-gray-300">Filtering by tag:</span>
                  <span className="font-medium text-white">{tagFilter}</span>
                </div>
                <button
                  onClick={() => {
                    setTagFilter(null);
                    router.push('/intelligence-center');
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center transition-colors"
                >
                  Clear filter
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </section>
          )}

          {/* Quick Stats Bar */}
          <section 
            className="bg-white dark:bg-gray-900 border-y border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 md:py-4"
            aria-label="Statistics"
            data-testid="filters-section"
          >
            {/* Mobile Stats - Scrollable */}
            {isMobile ? (
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="flex space-x-4 min-w-max">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{filteredEvents.length}</div>
                    <div className="text-xs text-gray-400">Events</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">{zones.length}</div>
                    <div className="text-xs text-gray-400">Zones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-400">
                      {filteredEvents.filter(e => (e as any).escalation_score >= 7).length}
                    </div>
                    <div className="text-xs text-gray-400">High Risk</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-400">{news?.length || 0}</div>
                    <div className="text-xs text-gray-400">News</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{armsDeals?.length || 0}</div>
                    <div className="text-xs text-gray-400">Arms</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    {loading ? (
                      <LoadingSkeleton variant="stat" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{filteredEvents.length}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 uppercase">Filtered Events</div>
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <LoadingSkeleton variant="stat" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{zones.length}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 uppercase">Active Zones</div>
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <LoadingSkeleton variant="stat" />
                    ) : (
                      <Tooltip content="Events with escalation score ≥7" position="bottom">
                        <>
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {filteredEvents.filter(e => (e as any).escalation_score >= 7).length}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 uppercase">High Risk</div>
                        </>
                      </Tooltip>
                    )}
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <LoadingSkeleton variant="stat" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-purple-400">{news?.length || 0}</div>
                        <div className="text-xs text-gray-400 uppercase">News Articles</div>
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <LoadingSkeleton variant="stat" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-green-400">{armsDeals?.length || 0}</div>
                        <div className="text-xs text-gray-400 uppercase">Arms Deals</div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Filters and Search */}
                <div className="flex items-center space-x-4">
                  {!isMobile && (
                    <SearchBar 
                      onSearch={setSearchQuery} 
                      placeholder="Search events..."
                      className="w-64"
                    />
                  )}
                  
                  {/* Time Range Filter */}
                  <div className="flex items-center space-x-2">
                    <label className="sr-only" htmlFor="time-range-filter">Time range filter</label>
                    <select 
                      id="time-range-filter"
                      className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded border border-gray-700"
                      value={timeRange}
                      onChange={(e) => {
                        setTimeRange(e.target.value);
                        analytics.trackFilter('time_range', e.target.value);
                      }}
                      aria-label="Time range filter"
                    >
                      <option value="1h">Last Hour</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                  
                  {/* Severity Filter */}
                  <div className="flex items-center space-x-2">
                    <label className="sr-only" htmlFor="severity-filter">Severity filter</label>
                    <select 
                      id="severity-filter"
                      className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded border border-gray-700"
                      value={severityFilter}
                      onChange={(e) => {
                        setSeverityFilter(e.target.value);
                        analytics.trackFilter('severity', e.target.value);
                      }}
                      aria-label="Severity filter"
                    >
                      <option value="all">All Severity</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            {/* Mobile Filters */}
            {isMobile && (
              <div className="mt-3 flex space-x-2">
                <select 
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
                <select 
                  className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-700"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                </select>
              </div>
            )}
          </section>

          {/* Conflict Zone Summary */}
          <section className="bg-gray-50 dark:bg-gray-950 px-4 md:px-6 py-6 md:py-8">
            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6">Global Conflict Zone Analysis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {loading ? (
                Array(6).fill(null).map((_, index) => (
                  <LoadingSkeleton key={index} variant="zone" />
                ))
              ) : zones.slice(0, 6).map((zone) => (
                <div
                  key={zone.id}
                  onClick={() => handleZoneSelect(zone)}
                  className="bg-white dark:bg-gray-900 rounded-lg p-3 md:p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-800 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">{zone.name}</h3>
                    <Tooltip 
                      content={
                        zone.escalationScore >= 7 ? "Critical threat level" :
                        zone.escalationScore >= 4 ? "Elevated threat level" :
                        "Low threat level"
                      }
                      position="left"
                    >
                      <span className={`text-xs px-2 py-1 rounded cursor-help ${
                        zone.escalationScore >= 7 ? 'bg-red-500/20 text-red-400' :
                        zone.escalationScore >= 4 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {zone.escalationScore.toFixed(1)}
                      </span>
                    </Tooltip>
                  </div>
                  <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                    <p>{zone.eventCount} events</p>
                    <p className="text-xs mt-1">
                      {new Date(zone.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Event Timeline & Intelligence Dashboard */}
          <section 
            id="conflict-dashboard"
            className="bg-white dark:bg-gray-900 min-h-[60vh] border-t border-gray-200 dark:border-gray-800"
          >
            <div className="h-full">
              <ConflictDashboard
                zone={selectedZone}
                events={zoneEvents}
                allEvents={rawEvents} // Pass all events for unfiltered severity distribution
                armsDeals={zoneArmsDeals}
                news={news}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onEventSelect={handleEventSelect}
                isMobile={isMobile}
                loading={loading}
              />
            </div>
          </section>

          {/* Arms Deal Intelligence (Optional Section) */}
          {((selectedZone && zoneArmsDeals.length > 0) || (!selectedZone && armsDeals && armsDeals.length > 0)) && (
            <section className="bg-gray-50 dark:bg-gray-950 px-6 py-8 border-t border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                Recent Arms Transactions
                {selectedZone && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    - {selectedZone.name.split(',')[0].trim()}
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(selectedZone ? zoneArmsDeals : armsDeals)
                  .sort((a, b) => {
                    // When no conflict selected, prioritize by: 1) value (descending), 2) date (recent first)
                    if (!selectedZone) {
                      const valueDiff = (b.dealValue || 0) - (a.dealValue || 0);
                      if (valueDiff !== 0) return valueDiff;
                    }
                    return new Date(b.date).getTime() - new Date(a.date).getTime();
                  })
                  .slice(0, 4)
                  .map((deal, index) => (
                  <div key={index} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white mb-1">{deal.weaponSystem || 'Undisclosed Equipment'}</p>
                        <p className="text-xs text-gray-400 mb-2">
                          {deal.sellerCountry || deal.sellerCompany} → {deal.buyerCountry}
                        </p>
                        <div className="flex items-center space-x-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full ${
                            deal.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                            deal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {deal.status}
                          </span>
                          <span className="text-gray-500">{formatDateCompact(deal.date)}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-green-400 ml-4">
                        {formatCurrency(deal.dealValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <footer className="bg-gray-50 dark:bg-gray-900/50 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 px-6 py-4">
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} text-xs`}>
              <div className="flex items-center justify-center space-x-4">
                <p className={`text-gray-500 dark:text-gray-500 ${isMobile ? 'hidden' : ''}`}>Intelligence updated every 5 minutes</p>
                {!isMobile && <span className="text-gray-300 dark:text-gray-700">•</span>}
                <Link 
                  href="/about" 
                  className="text-gray-700 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  About
                </Link>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <Link 
                  href="/feedback" 
                  className="text-gray-700 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Feedback
                </Link>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <Link 
                  href="/account/settings" 
                  className="text-gray-700 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  Settings
                </Link>
                {isAdmin && (
                  <>
                    <span className="text-gray-300 dark:text-gray-700">•</span>
                    <Link 
                      href="/admin/events" 
                      className="text-red-700 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors font-medium"
                    >
                      Admin
                    </Link>
                  </>
                )}
              </div>
              <p className={`text-gray-500 dark:text-gray-500 ${isMobile ? 'text-center' : ''}`}>
                Last sync: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : 'Loading...'}
              </p>
            </div>
          </footer>
            </>
          )}
        </main>
      </div>
      
      {/* Feedback Popup */}
      <FeedbackPopup />
      
      {/* Help Button */}
      <HelpButton />
      
      {/* Ingestion Button - Only show for authenticated users */}
      {/* HIDDEN FOR V1 LAUNCH - Re-enable for v2 */}
      {/* {isAuthenticated && <IngestButton />} */}
      
      {/* Real-time Event Stream */}
      {/* HIDDEN FOR V1 LAUNCH - Re-enable for v2 */}
      {/* {isAuthenticated && !isMobile && <RealTimeStream />} */}
      
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <WelcomeModal onClose={() => setShowWelcomeModal(false)} />
      )}
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal shortcuts={shortcuts} />
    </div>
  );
}