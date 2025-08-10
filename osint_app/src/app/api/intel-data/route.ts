import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper to detect Safari
function isSafariBrowser(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isIOSSafari = /iPad|iPhone|iPod/.test(userAgent) && !/CriOS/.test(userAgent);
  return isSafari || isIOSSafari;
}

// Helper to log request details for debugging
function logRequestDetails(request: NextRequest, isSafari: boolean) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent');
  const origin = headersList.get('origin');
  const referer = headersList.get('referer');
  const authorization = headersList.get('authorization');
  const contentType = headersList.get('content-type');
  const accept = headersList.get('accept');
  
  console.log('🔍 Intel-Data API Request Details:', {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    isSafari,
    headers: {
      userAgent,
      origin,
      referer,
      authorization: authorization ? `Bearer ${authorization.slice(0, 20)}...` : 'None',
      contentType,
      accept,
      // Safari-specific headers
      'x-requested-with': headersList.get('x-requested-with'),
      'cache-control': headersList.get('cache-control'),
    },
    searchParams: Object.fromEntries(request.nextUrl.searchParams),
  });
}

// Aggregated intelligence data endpoint
export async function GET(request: NextRequest) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent');
  const isSafari = isSafariBrowser(userAgent);
  
  try {
    // Log request details for debugging
    logRequestDetails(request, isSafari);
    
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('❌ [Intel-Data] Supabase client not initialized');
      return NextResponse.json(
        { 
          error: 'Database connection not configured',
          browser: isSafari ? 'safari' : 'other'
        },
        { status: 503 }
      );
    }
    
    // Get authorization header - Safari might send it differently
    const authorization = headersList.get('authorization');
    const bearerToken = authorization?.startsWith('Bearer ') 
      ? authorization.substring(7) 
      : authorization;
    
    // Log authentication status
    console.log('🔐 [Intel-Data] Auth status:', {
      hasAuth: !!authorization,
      tokenLength: bearerToken?.length || 0,
      isSafari
    });
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const dataTypes = searchParams.get('types')?.split(',') || ['events', 'news', 'arms-deals'];
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const results: any = {};
    const errors: any = {};
    
    // Fetch events if requested
    if (dataTypes.includes('events')) {
      try {
        console.log('📊 [Intel-Data] Fetching events...');
        const { data: events, error } = await supabase
          .from('events')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(limit);
          
        if (error) throw error;
        results.events = events || [];
        console.log(`✅ [Intel-Data] Fetched ${results.events.length} events`);
      } catch (error) {
        console.error('❌ [Intel-Data] Events fetch error:', error);
        errors.events = error instanceof Error ? error.message : 'Unknown error';
        results.events = [];
      }
    }
    
    // Fetch news if requested
    if (dataTypes.includes('news')) {
      try {
        console.log('📰 [Intel-Data] Fetching news...');
        const { data: news, error } = await supabase
          .from('news_with_sources')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(limit);
          
        if (error) throw error;
        results.news = news || [];
        console.log(`✅ [Intel-Data] Fetched ${results.news.length} news items`);
      } catch (error) {
        console.error('❌ [Intel-Data] News fetch error:', error);
        errors.news = error instanceof Error ? error.message : 'Unknown error';
        results.news = [];
      }
    }
    
    // Fetch arms deals if requested
    if (dataTypes.includes('arms-deals')) {
      try {
        console.log('💰 [Intel-Data] Fetching arms deals...');
        const { data: armsDeals, error } = await supabase
          .from('arms_deals')
          .select('*')
          .order('date', { ascending: false })
          .limit(limit);
          
        if (error) throw error;
        results.armsDeals = armsDeals || [];
        console.log(`✅ [Intel-Data] Fetched ${results.armsDeals.length} arms deals`);
      } catch (error) {
        console.error('❌ [Intel-Data] Arms deals fetch error:', error);
        errors.armsDeals = error instanceof Error ? error.message : 'Unknown error';
        results.armsDeals = [];
      }
    }
    
    // Safari-specific response handling
    const response = NextResponse.json({
      success: true,
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      meta: {
        page,
        limit,
        dataTypes,
        browser: isSafari ? 'safari' : 'other',
        timestamp: new Date().toISOString()
      }
    });
    
    // Add Safari-specific headers
    if (isSafari) {
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ [Intel-Data] API error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      isSafari,
      userAgent
    });
    
    // Return Safari-friendly error response
    const errorResponse = NextResponse.json(
      { 
        error: 'Failed to fetch intelligence data',
        message: error instanceof Error ? error.message : 'Unknown error',
        browser: isSafari ? 'safari' : 'other',
        data: {
          events: [],
          news: [],
          armsDeals: []
        }
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
    
    return errorResponse;
  }
}

// OPTIONS handler for Safari preflight requests
export async function OPTIONS(request: NextRequest) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent');
  const isSafari = isSafariBrowser(userAgent);
  
  console.log('🔍 [Intel-Data] OPTIONS request:', {
    isSafari,
    origin: headersList.get('origin'),
    method: headersList.get('access-control-request-method'),
    headers: headersList.get('access-control-request-headers')
  });
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': headersList.get('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}