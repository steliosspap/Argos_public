import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Restore Event] Missing Supabase environment variables');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('[Restore Event] Supabase client not initialized');
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

    const userId = decoded.id || decoded.userId;  // Support both id and userId

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 });
    }

    // Get the event ID from request body
    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Check if event exists and is deleted
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.deleted) {
      return NextResponse.json({ error: 'Event is not deleted' }, { status: 400 });
    }

    // Restore the event
    const { data: restoredEvent, error: updateError } = await supabase
      .from('events')
      .update({
        deleted: false,
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null
      })
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('Error restoring event:', updateError);
      return NextResponse.json({ error: 'Failed to restore event' }, { status: 500 });
    }

    // Log the restoration action
    console.log(`Event ${eventId} restored by ${userData.email} (${userId})`);

    // Create a restoration log entry
    const { error: logError } = await supabase
      .from('event_deletion_log')
      .insert({
        event_id: eventId,
        deleted_by: userId,
        deletion_reason: `RESTORED: Event restored by ${userData.email}`,
        event_snapshot: event,
        user_email: userData.email,
        user_name: userData.name || userData.email
      });

    if (logError) {
      console.error('Error logging restoration:', logError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'Event restored successfully',
      event: {
        id: restoredEvent.id,
        title: restoredEvent.title
      }
    });

  } catch (error) {
    console.error('Error in restore event endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}