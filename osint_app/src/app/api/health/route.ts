import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Health check endpoint for debugging Safari issues
export async function GET(request: NextRequest) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || '';
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseInitialized: !!supabase,
    },
    request: {
      method: request.method,
      url: request.url,
      headers: {
        userAgent,
        origin: headersList.get('origin'),
        referer: headersList.get('referer'),
        authorization: headersList.get('authorization') ? 'Present' : 'None',
        contentType: headersList.get('content-type'),
        accept: headersList.get('accept'),
        cookie: headersList.get('cookie') ? 'Present' : 'None',
      },
      isSafari,
    },
    database: {
      connected: false,
      error: null as string | null
    }
  };
  
  // Test database connection
  if (supabase) {
    try {
      const { error } = await supabase.from('events').select('id').limit(1);
      healthData.database.connected = !error;
      healthData.database.error = error?.message || null;
    } catch (e) {
      healthData.database.error = e instanceof Error ? e.message : 'Unknown error';
    }
  }
  
  return NextResponse.json(healthData, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': 'true'
    }
  });
}

// HEAD method for lightweight checks
export async function HEAD(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'X-Health-Status': 'ok',
      'X-Timestamp': new Date().toISOString()
    }
  });
}