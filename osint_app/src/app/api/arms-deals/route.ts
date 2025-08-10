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

// Real-time arms deals API endpoint - fetches from Supabase
export async function GET(request: NextRequest) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent');
  const isSafari = isSafariBrowser(userAgent);
  
  try {
    console.log('📡 Fetching real-time arms deals from database...');
    console.log('🔍 Request details:', {
      isSafari,
      origin: headersList.get('origin'),
      authorization: headersList.get('authorization') ? 'Present' : 'Missing',
      contentType: headersList.get('content-type'),
      accept: headersList.get('accept')
    });
    
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 503 }
      );
    }
    
    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const { count: totalCount } = await supabase
      .from('arms_deals')
      .select('*', { count: 'exact', head: true });
    
    const { data: deals, error } = await supabase
      .from('arms_deals')
      .select('*')
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log(`✅ Fetched ${deals?.length || 0} arms deals from database`);

    // Transform to match frontend expectations (camelCase)
    const transformedDeals = (deals || []).map(item => ({
      id: item.id,
      date: item.date,
      buyerCountry: item.buyer_country,
      sellerCountry: item.seller_country,
      sellerCompany: item.seller_company,
      weaponSystem: item.weapon_system,
      dealValue: item.deal_value,
      currency: item.currency,
      sourceLink: item.source_link,
      description: item.description,
      status: item.status,
      createdAt: item.created_at
    }));

    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    const response = NextResponse.json({
      data: transformedDeals,
      meta: {
        total: totalCount || 0,
        page: page,
        limit: limit,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
    
    // Add Safari-specific headers to prevent caching issues
    if (isSafari) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('X-Content-Type-Options', 'nosniff');
    }
    
    return response;
  } catch (error) {
    console.error('Arms deals API error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return a properly formatted error response
    return NextResponse.json(
      { 
        error: 'Failed to fetch arms deals from database',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: [] 
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}