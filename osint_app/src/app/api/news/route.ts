import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Real-time news API endpoint - fetches from Supabase
export async function GET(request: NextRequest) {
  try {
    console.log('📡 Fetching real-time news from database...');
    
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      const debugInfo = {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        nodeEnv: process.env.NODE_ENV
      };
      
      // Only log debug info in development
      if (process.env.NODE_ENV !== 'production') {
        console.error('Env check:', debugInfo);
      }
      
      return NextResponse.json(
        { 
          error: 'Database connection not configured',
          // Only include debug info in development
          ...(process.env.NODE_ENV !== 'production' && { debug: debugInfo })
        },
        { status: 503 }
      );
    }
    
    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    // Check for user authentication and get preferences
    let blockedSources: string[] = [];
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return NextResponse.json(
        { error: 'JWT_SECRET environment variable is required' },
        { status: 500 }
      );
    }
    const decoded: any = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        // Get user preferences
        const { data: userData } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', userId)
          .single();
          
        if (userData?.preferences?.blockedSources) {
          blockedSources = userData.preferences.blockedSources;
        }
      } catch (error) {
        // If token verification fails, continue without user preferences
        console.log('Token verification failed, continuing without user preferences');
      }
    }
    
    // Get total count for pagination metadata
    const { count: totalCount } = await supabase
      .from('news_with_sources')
      .select('*', { count: 'exact', head: true });
    
    const { data: news, error } = await supabase
      .from('news_with_sources')
      .select('*')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log(`✅ Fetched ${news?.length || 0} news items from database`);

    // Filter out news from blocked sources
    const filteredNews = (news || []).filter((item: any) => {
      if (blockedSources.length === 0) return true;
      
      // Check primary source
      const primarySource = item.primary_source || item.source || '';
      if (blockedSources.some(blocked => 
        primarySource.toLowerCase().includes(blocked.toLowerCase())
      )) {
        return false;
      }
      
      // For multi-source articles, check if any non-blocked sources remain
      if (item.is_multi_source && item.sources) {
        const remainingSources = item.sources.filter((source: any) => 
          !blockedSources.some(blocked => 
            source.source.toLowerCase().includes(blocked.toLowerCase())
          )
        );
        return remainingSources.length > 0;
      }
      
      return true;
    });

    // Transform to match frontend expectations with multi-source support
    const transformedNews = filteredNews.map((item: any) => ({
      id: item.id,
      headline: item.title || item.summary || 'No headline',
      title: item.title || item.summary || 'No title',
      summary: item.summary || '',
      content: item.summary || '',
      url: item.url,
      source: item.primary_source || item.source,
      source_urls: item.sources?.map((s: any) => s.url) || [item.url],
      source_count: item.source_count || 1,
      is_multi_source: item.is_multi_source || false,
      sources: item.sources || [],
      published_at: item.published_at,
      created_at: item.created_at,
      date: item.published_at,
      region: item.region || 'Global',
      country: item.country,
      conflict_region: item.region || 'Global',
      escalation_level: item.escalation_score >= 8 ? 'critical' : 
                       item.escalation_score >= 6 ? 'high' :
                       item.escalation_score >= 4 ? 'medium' : 'low',
      escalation_score: item.escalation_score || 5,
      sentiment_score: 0.5,
      tags: item.tags || [],
      // Bias and fact-check data
      bias_score: item.bias_score,
      verification_status: item.verification_status,
      has_analysis: !!(item.bias_analysis_id || item.fact_check_id)
    }));

    const totalPages = Math.ceil((totalCount || 0) / limit);
    
    return NextResponse.json({
      data: transformedNews,
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
    console.error('News API error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return a properly formatted error response
    return NextResponse.json(
      { 
        error: 'Failed to fetch news from database',
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