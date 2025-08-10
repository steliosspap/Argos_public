import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client lazily to avoid build errors
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

export async function POST(request: NextRequest) {
  try {
    const { events } = await request.json();

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid events data' },
        { status: 400 }
      );
    }

    // In production, you would:
    // 1. Validate the events
    // 2. Store them in a database or send to an analytics service
    // 3. Potentially aggregate them for reporting

    // For now, we'll store them in a simple analytics table
    const client = getSupabaseClient();
    
    if (client) {
      const { error } = await client
        .from('analytics_events')
        .insert(
          events.map(event => ({
            ...event,
            user_id: request.headers.get('x-user-id') || 'anonymous',
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
            user_agent: request.headers.get('user-agent'),
            created_at: new Date().toISOString()
          }))
        );

      if (error) {
        // Silently fail - analytics table might not exist yet
        // Don't log error to avoid console spam
      }
    } else {
      // Log to console if Supabase isn't available
      console.log('Analytics events (Supabase not configured):', events);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Don't return error to client - analytics shouldn't break the app
    return NextResponse.json({ success: true });
  }
}