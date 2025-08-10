import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GeoJSON endpoint for real-time conflict events
export async function GET(request: NextRequest) {
  try {
    console.log('🗺️ Fetching events as GeoJSON...');
    
    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const { count: totalCount } = await supabase
      .from('events_with_coords')
      .select('*', { count: 'exact', head: true });
    
    const { data: events, error } = await supabase
      .from('events_with_coords')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log(`✅ Converting ${events?.length || 0} events to GeoJSON`);

    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    // Convert to GeoJSON format
    const geojsonData = {
      type: 'FeatureCollection' as const,
      metadata: {
        total: totalCount || 0,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      features: (events || [])
        .filter(item => {
          // Ensure valid coordinates
          const lat = item.latitude;
          const lng = item.longitude;
          return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && 
                 lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        })
        .map(item => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [item.longitude, item.latitude] // GeoJSON uses [lng, lat]
          },
          properties: {
            id: item.id,
            title: item.title || 'Untitled Event',
            description: item.summary || '',
            escalation_score: item.escalation_score || item.reliability || 5,
            severity: item.severity || 'medium',
            region: item.region || 'Unknown',
            country: item.country || 'Unknown',
            date: item.timestamp,
            source: item.channel || 'Unknown',
            event_type: item.event_classifier?.[0] || 'conflict',
            url: item.source_url
          }
        }))
    };

    return NextResponse.json(geojsonData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('GeoJSON API error:', error);
    return NextResponse.json(
      { 
        type: 'FeatureCollection',
        features: [],
        error: 'Failed to fetch events' 
      },
      { status: 500 }
    );
  }
}