import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper function to calculate similarity between two strings
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Helper function to check if two events are similar
function areEventsSimilar(event1: any, event2: any): boolean {
  // Skip if they have the same ID
  if (event1.id === event2.id) return true;
  
  // Check if events are within 2 hours of each other (reduced from 24)
  const timeDiff = Math.abs(new Date(event1.timestamp).getTime() - new Date(event2.timestamp).getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff > 2) return false;
  
  // Check if events are in the same location
  const sameLocation = (
    (event1.country === event2.country && event1.region === event2.region) ||
    (Math.abs(event1.latitude - event2.latitude) < 0.1 && Math.abs(event1.longitude - event2.longitude) < 0.1)
  );
  
  if (sameLocation) {
    // Check title/summary similarity
    const titleSimilarity = calculateSimilarity(
      event1.title || event1.summary || '', 
      event2.title || event2.summary || ''
    );
    
    return titleSimilarity > 0.7; // Increased threshold to 70%
  }
  
  return false;
}

// Helper function to deduplicate events with geographic diversity
function deduplicateEvents(events: any[]): any[] {
  const deduplicated: any[] = [];
  const locationCounts: { [key: string]: number } = {};
  
  // Sort by timestamp descending and severity
  const sorted = [...events].sort((a, b) => {
    // First by severity (higher first)
    const severityOrder: { [key: string]: number } = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    if (severityDiff !== 0) return severityDiff;
    
    // Then by timestamp (newer first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  for (const event of sorted) {
    const locationKey = `${event.country || 'unknown'}_${event.region || 'unknown'}`;
    const locationCount = locationCounts[locationKey] || 0;
    
    // Skip if we've already processed a similar event
    let isDuplicate = false;
    
    // Only check for duplicates if we already have many events from this location
    if (locationCount < 5) {
      // More lenient duplicate checking for underrepresented locations
      for (let i = 0; i < deduplicated.length; i++) {
        if (event.id === deduplicated[i].id) {
          isDuplicate = true;
          break;
        }
      }
    } else {
      // Stricter duplicate checking for overrepresented locations
      for (let i = 0; i < deduplicated.length; i++) {
        if (areEventsSimilar(event, deduplicated[i])) {
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(event);
      locationCounts[locationKey] = locationCount + 1;
    }
  }
  
  return deduplicated;
}

// Helper function to ensure temporal distribution
function ensureTemporalDistribution(events: any[], targetCount: number = 1000): any[] {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Categorize events by time period
  const last24h = events.filter(e => new Date(e.timestamp) > oneDayAgo);
  const last7d = events.filter(e => new Date(e.timestamp) > sevenDaysAgo && new Date(e.timestamp) <= oneDayAgo);
  const last30d = events.filter(e => new Date(e.timestamp) > thirtyDaysAgo && new Date(e.timestamp) <= sevenDaysAgo);
  const older = events.filter(e => new Date(e.timestamp) <= thirtyDaysAgo);
  
  // Calculate proportions (prioritize recent events)
  const proportions = {
    last24h: 0.4,   // 40% from last 24 hours
    last7d: 0.3,    // 30% from last 7 days
    last30d: 0.2,   // 20% from last 30 days
    older: 0.1      // 10% older events
  };
  
  const selected: any[] = [];
  
  // Select events from each time period
  const counts = {
    last24h: Math.min(last24h.length, Math.floor(targetCount * proportions.last24h)),
    last7d: Math.min(last7d.length, Math.floor(targetCount * proportions.last7d)),
    last30d: Math.min(last30d.length, Math.floor(targetCount * proportions.last30d)),
    older: Math.min(older.length, Math.floor(targetCount * proportions.older))
  };
  
  // Add events from each period
  selected.push(...last24h.slice(0, counts.last24h));
  selected.push(...last7d.slice(0, counts.last7d));
  selected.push(...last30d.slice(0, counts.last30d));
  selected.push(...older.slice(0, counts.older));
  
  // If we don't have enough, fill from the most recent events
  if (selected.length < targetCount) {
    const allSorted = events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    for (const event of allSorted) {
      if (!selected.find(e => e.id === event.id)) {
        selected.push(event);
        if (selected.length >= targetCount) break;
      }
    }
  }
  
  return selected.slice(0, targetCount);
}

export async function GET(request: NextRequest) {
  try {
    console.log('🗺️ Fetching events for OSINT map...');
    
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return NextResponse.json(
        { 
          data: [], 
          error: 'Database connection not configured',
          meta: {
            total: 0,
            page: 1,
            limit: 100,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false
          }
        },
        { status: 503 }
      );
    }
    
    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    // Get filter parameters from query string
    const filterByCountry = searchParams.get('filterByCountry') !== 'false'; // Default to true for backward compatibility
    const countries = searchParams.get('countries')?.split(',').filter(Boolean);
    
    // List of countries with ongoing armed conflicts (based on Wikipedia's list)
    // This list is now optional and can be overridden by query parameters
    const ongoingConflicts = countries && countries.length > 0 ? countries : [
      // Major wars (10,000+ deaths in current/past year)
      'Ukraine', 'Russia', 'Myanmar', 'Sudan', 'South Sudan',
      
      // Wars (1,000-9,999 deaths in current/past year)
      'Israel', 'Palestine', 'Gaza', 'West Bank', 'Lebanon',
      'Syria', 'Iraq', 'Yemen', 'Somalia', 'Mali', 'Burkina Faso',
      'Nigeria', 'Niger', 'Cameroon', 'Chad', 'Ethiopia',
      'Democratic Republic of the Congo', 'DRC', 'Congo',
      'Afghanistan', 'Pakistan', 'Mexico',
      
      // Minor conflicts (100-999 deaths)
      'Libya', 'Egypt', 'Iran', 'Turkey', 'Algeria', 'Tunisia',
      'Central African Republic', 'Mozambique', 'Kenya',
      'Colombia', 'Philippines', 'India', 'Thailand'
    ];

    // Fetch events from the last 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    // Build query for total count
    let countQuery = supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .eq('deleted', false)  // Exclude soft-deleted events
      .gte('timestamp', sixtyDaysAgo.toISOString());
    
    // Only apply country filter if requested
    if (filterByCountry) {
      countQuery = countQuery.in('country', ongoingConflicts);
    }
    
    const { count: totalCount } = await countQuery;
    
    // Build main query
    let eventsQuery = supabase
      .from('events')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .eq('deleted', false)  // Exclude soft-deleted events
      .gte('timestamp', sixtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Only apply country filter if requested
    if (filterByCountry) {
      eventsQuery = eventsQuery.in('country', ongoingConflicts);
    }
    
    const { data: eventsData, error: eventsError } = await eventsQuery;
    
    if (eventsError) {
      console.error('Supabase error:', eventsError);
      throw eventsError;
    }

    console.log(`✅ Fetched ${eventsData?.length || 0} total events`);

    // Filter for valid coordinates
    const validEvents = (eventsData || []).filter(item => {
      const lat = item.latitude;
      const lng = item.longitude;
      return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && 
             lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });

    console.log(`📍 ${validEvents.length} events have valid coordinates`);

    // Enhanced deduplication - by ID and by content_hash
    const seenIds = new Set();
    const seenHashes = new Set();
    const seenTitles = new Map(); // title -> timestamp map for similar title detection
    
    const uniqueEvents = validEvents.filter(event => {
      // Check ID duplicate
      if (seenIds.has(event.id)) {
        return false;
      }
      seenIds.add(event.id);
      
      // Check content_hash duplicate if available
      if (event.content_hash && seenHashes.has(event.content_hash)) {
        return false;
      }
      if (event.content_hash) {
        seenHashes.add(event.content_hash);
      }
      
      // Check for very similar titles within 2 hours
      const eventTime = new Date(event.timestamp).getTime();
      const titleLower = (event.title || '').toLowerCase().trim();
      
      if (titleLower) {
        // Check if we've seen a very similar title recently
        for (const [seenTitle, seenTime] of seenTitles.entries()) {
          const timeDiff = Math.abs(eventTime - seenTime) / (1000 * 60 * 60); // hours
          if (timeDiff < 2 && calculateSimilarity(titleLower, seenTitle) > 0.8) {
            return false; // Skip this duplicate
          }
        }
        seenTitles.set(titleLower, eventTime);
      }
      
      return true;
    });
    
    console.log(`🔄 Removed ${validEvents.length - uniqueEvents.length} duplicates (by ID, content_hash, and title similarity)`);

    // Sort by severity and recency
    const sortBySeverityAndTime = (a: any, b: any) => {
      const severityOrder: { [key: string]: number } = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    };
    
    const sorted = [...uniqueEvents].sort(sortBySeverityAndTime);
    
    // Use the paginated data as is (no additional slicing needed)
    const distributed = sorted;
    console.log(`📊 Selected ${distributed.length} events from conflict zones (page ${page})`);

    // Transform to the format expected by OSINTMap component
    const transformedData = distributed.map(item => ({
      id: item.id,
      title: item.title || item.summary || 'Untitled Event',
      summary: item.summary || '',
      location: {
        coordinates: [item.longitude, item.latitude] // [lng, lat] format for GeoJSON
      },
      country: item.country || 'Unknown',
      region: item.region || 'Unknown',
      timestamp: item.timestamp,
      channel: item.channel || 'Unknown',
      reliability: item.reliability || 0.5,
      event_classifier: item.event_classifier || [],
      severity: item.severity || 'medium',
      source_url: item.source_url || '',
      created_at: item.created_at || item.timestamp,
      escalation_score: item.escalation_score || 5
    }));

    // Log temporal distribution stats
    const now = new Date();
    const stats = {
      last24h: transformedData.filter(e => new Date(e.timestamp) > new Date(now.getTime() - 24 * 60 * 60 * 1000)).length,
      last7d: transformedData.filter(e => new Date(e.timestamp) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length,
      last30d: transformedData.filter(e => new Date(e.timestamp) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length,
    };
    console.log(`📈 Distribution - 24h: ${stats.last24h}, 7d: ${stats.last7d}, 30d: ${stats.last30d}`);

    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    return NextResponse.json({
      data: transformedData,
      meta: {
        total: totalCount || 0,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Events API error:', error);
    
    return NextResponse.json(
      {
        data: [],
        total: 0,
        error: 'Unable to fetch events'
      },
      { 
        status: 503,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}