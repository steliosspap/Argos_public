import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Admin Events List] Missing Supabase environment variables');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function GET(request: NextRequest) {
  console.log('[Admin Events List] Request received');
  
  try {
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('[Admin Events List] Supabase client not initialized');
      console.error('[Admin Events List] Supabase URL:', !!supabaseUrl);
      console.error('[Admin Events List] Supabase Key:', !!supabaseKey);
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 503 }
      );
    }
    
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token
    let decoded: any;
    try {
      const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'JWT_SECRET environment variable is required' },
        { status: 500 }
      );
    }
    decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Simply check the role from the JWT token - no need for DB lookup
    if (decoded.role !== 'admin') {
      console.log('[Admin Events] Access denied. Token role:', decoded.role);
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }
    
    console.log('[Admin Events] Admin access granted for user:', decoded.username);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const sortBy = searchParams.get('sortBy') || 'newest';
    const timeFilter = searchParams.get('timeFilter') || '60d';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build the query - EXCLUDE ACLED events
    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .or('deleted.is.null,deleted.eq.false')  // Handle both null and false
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .not('channel', 'eq', 'ACLED')  // Exclude ACLED events
      .not('source_url', 'like', '%acleddata%');  // Also exclude by URL pattern

    // Apply time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (timeFilter) {
        case '24h':
          filterDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          filterDate.setDate(now.getDate() - 30);
          break;
        case '60d':
          filterDate.setDate(now.getDate() - 60);
          break;
      }
      
      query = query.gte('timestamp', filterDate.toISOString());
    }

    // Apply sorting - ONLY by timestamp, not by severity
    query = query.order('timestamp', { ascending: sortBy === 'oldest' });

    // Execute the query with pagination
    console.log('[Admin Events List] Executing query with params:', {
      sortBy, timeFilter, page, limit,
      range: `${(page - 1) * limit} to ${page * limit - 1}`
    });
    
    const { data: events, error: fetchError, count } = await query
      .range((page - 1) * limit, page * limit - 1);

    if (fetchError) {
      console.error('[Admin Events List] Error fetching events:', fetchError);
      console.error('[Admin Events List] Error details:', {
        message: fetchError.message,
        code: fetchError.code,
        details: fetchError.details
      });
      return NextResponse.json({ 
        error: 'Failed to fetch events',
        details: fetchError.message 
      }, { status: 500 });
    }
    
    console.log(`[Admin Events List] Fetched ${events?.length || 0} events, total count: ${count}`);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      data: events || [],
      meta: {
        total: count || 0,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error in admin events list endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}