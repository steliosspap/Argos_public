import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get Supabase admin client
    const supabase = getSupabaseAdmin();
    
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'JWT_SECRET environment variable is required' },
        { status: 500 }
      );
    }
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[Delete Event] JWT verification successful');
    } catch (error) {
      console.error('[Delete Event] JWT verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.id || decoded.userId;  // Support both id and userId
    
    console.log('[Delete Event] Decoded token:', { userId, decoded });

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single();
    
    console.log('[Delete Event] User lookup result:', { userData, userError, userId });

    if (userError || !userData) {
      console.error('[Delete Event] User not found:', { userError, userId });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    // Get the event ID and deletion reason from request body
    const body = await request.json();
    const { eventId, deletionReason, deletionNotes } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.deleted) {
      return NextResponse.json({ error: 'Event is already deleted' }, { status: 400 });
    }
    
    // Prevent deletion of ACLED events
    if (event.channel === 'ACLED' || (event.source_url && event.source_url.includes('acleddata'))) {
      return NextResponse.json({ error: 'ACLED events cannot be deleted - they are for research purposes only' }, { status: 403 });
    }

    // Perform soft delete
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_reason: deletionReason || null,
        deletion_notes: deletionNotes || null
      })
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('Error deleting event:', updateError);
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    // Log the deletion action
    console.log(`Event ${eventId} deleted by ${userData.email} (${userId})`);

    return NextResponse.json({ 
      success: true,
      message: 'Event deleted successfully',
      event: {
        id: updatedEvent.id,
        title: updatedEvent.title,
        deleted_at: updatedEvent.deleted_at,
        deletion_reason: updatedEvent.deletion_reason,
        deletion_notes: updatedEvent.deletion_notes
      }
    });

  } catch (error) {
    console.error('Error in delete event endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to retrieve deleted events (admin only)
export async function GET(request: NextRequest) {
  try {
    // Get Supabase admin client
    const supabase = getSupabaseAdmin();
    
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'JWT_SECRET environment variable is required' },
        { status: 500 }
      );
    }
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[Delete Event] JWT verification successful');
    } catch (error) {
      console.error('[Delete Event] JWT verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.id || decoded.userId;  // Support both id and userId
    
    console.log('[Get Deleted Events] Decoded token:', { userId, decoded });

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    console.log('[Get Deleted Events] User lookup result:', { userData, userError, userId });

    if (userError || !userData || userData.role !== 'admin') {
      console.error('[Get Deleted Events] Access denied:', { userError, userData, userId });
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get total count of deleted events
    const { count: totalCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('deleted', true);

    // Fetch deleted events with user info
    const { data: deletedEvents, error: fetchError } = await supabase
      .from('archived_events')
      .select('*')
      .order('deleted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error('Error fetching deleted events:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch deleted events' }, { status: 500 });
    }

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      data: deletedEvents || [],
      meta: {
        total: totalCount || 0,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error in get deleted events endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}