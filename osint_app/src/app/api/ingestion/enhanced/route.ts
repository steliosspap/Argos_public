import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IntelligentIngestion } from '../../../../lib/intelligent-ingestion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get current ingestion status
    const { data: latestRun } = await supabase
      .from('search_queries_executed')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(10);

    const { data: recentEvents } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: sources } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);

    return NextResponse.json({
      status: 'ready',
      lastRun: latestRun?.[0]?.executed_at || null,
      recentSearches: latestRun?.length || 0,
      activeEvents: recentEvents?.length || 0,
      activeSources: sources?.length || 0,
      capabilities: {
        twoRoundSearch: true,
        eventClustering: true,
        crossSourceVerification: true,
        reliabilityScoring: true
      }
    });
  } catch (error) {
    console.error('Error fetching ingestion status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ingestion status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { mode = 'auto', limit = 50 } = await request.json();

    // Check if ingestion is already running
    const { data: runningJobs } = await supabase
      .from('search_queries_executed')
      .select('*')
      .gte('executed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .eq('query_type', 'ingestion_run');

    if (runningJobs && runningJobs.length > 0) {
      return NextResponse.json({
        status: 'already_running',
        message: 'Ingestion is already in progress',
        startedAt: runningJobs[0].executed_at
      });
    }

    // Log ingestion start
    await supabase.from('search_queries_executed').insert({
      query_text: `Enhanced ingestion started - mode: ${mode}, limit: ${limit}`,
      query_type: 'ingestion_run',
      query_round: 0,
      results_count: 0,
      success: true
    });

    // Initialize enhanced ingestion
    const ingestion = new IntelligentIngestion({
      dryRun: false,
      verbose: true,
      limit: limit
    });

    // Start ingestion in background (don't await)
    runIngestionAsync(ingestion);

    return NextResponse.json({
      status: 'started',
      message: 'Enhanced ingestion started successfully',
      mode: mode,
      limit: limit,
      features: {
        conflictTracking: true,
        twoRoundSearch: true,
        entityExtraction: true,
        reliabilityScoring: true
      }
    });
  } catch (error) {
    console.error('Error starting ingestion:', error);
    return NextResponse.json(
      { error: 'Failed to start ingestion' },
      { status: 500 }
    );
  }
}

// Run ingestion asynchronously
async function runIngestionAsync(ingestion: any) {
  try {
    console.log('Starting enhanced ingestion cycle...');
    const results = await ingestion.run();
    
    // Log completion
    await supabase.from('search_queries_executed').insert({
      query_text: `Enhanced ingestion completed - Articles: ${results.total_articles || 0}, Events: ${results.new_articles || 0}`,
      query_type: 'ingestion_complete',
      query_round: 2,
      results_count: results.total_articles || 0,
      success: true
    });
    
    console.log('Enhanced ingestion completed:', results);
  } catch (error) {
    console.error('Ingestion error:', error);
    
    // Log error
    await supabase.from('search_queries_executed').insert({
      query_text: 'Enhanced ingestion failed',
      query_type: 'ingestion_error',
      query_round: 0,
      results_count: 0,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}