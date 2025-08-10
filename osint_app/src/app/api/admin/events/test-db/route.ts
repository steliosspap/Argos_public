import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...');
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Missing Supabase credentials',
        url: !!supabaseUrl,
        key: !!supabaseKey
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test 1: Check if events table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('events')
      .select('count')
      .limit(1);
      
    if (tableError) {
      return NextResponse.json({
        error: 'Cannot access events table',
        details: tableError.message,
        code: tableError.code
      }, { status: 500 });
    }
    
    // Test 2: Check if deleted column exists
    const { data: columnCheck, error: columnError } = await supabase
      .from('events')
      .select('id, deleted')
      .limit(1);
      
    if (columnError) {
      return NextResponse.json({
        error: 'Deleted column might not exist',
        details: columnError.message,
        code: columnError.code,
        hint: 'Run the migration: database/migrations/add_soft_delete_to_events.sql'
      }, { status: 500 });
    }
    
    // Test 3: Get some events
    const { data: events, error: eventsError, count } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .limit(5)
      .order('timestamp', { ascending: false });
      
    if (eventsError) {
      return NextResponse.json({
        error: 'Cannot fetch events',
        details: eventsError.message,
        code: eventsError.code
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      tests: {
        tableExists: true,
        deletedColumnExists: columnCheck !== null,
        totalEvents: count,
        sampleEvents: events?.length || 0,
        firstEvent: events?.[0] ? {
          id: events[0].id,
          title: events[0].title,
          deleted: events[0].deleted,
          timestamp: events[0].timestamp
        } : null
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error.message
    }, { status: 500 });
  }
}