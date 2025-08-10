import { NextRequest, NextResponse } from 'next/server';
import { AnalysisPipeline } from '@/lib/analysis-pipeline';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum execution time
export const maxDuration = 300;

/**
 * GET /api/cron/analyze-news
 * Cron job to automatically analyze new articles
 * Can be triggered by Vercel cron or external services
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional security measure)
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting automated news analysis...');

    // Initialize analysis pipeline
    const pipeline = new AnalysisPipeline({
      openaiApiKey: process.env.OPENAI_API_KEY!,
      googleApiKey: process.env.GOOGLE_API_KEY!,
      googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID!,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      enableCaching: true
    });

    // Analyze up to 20 articles per cron run
    const results = await pipeline.analyzeNewsFromDatabase(20);

    console.log(`[Cron] Analyzed ${results.length} articles`);

    // Log summary statistics
    const stats = {
      totalAnalyzed: results.length,
      averageTrustScore: results.reduce((sum, r) => sum + r.overallTrustScore, 0) / (results.length || 1),
      verifiedCount: results.filter(r => r.factCheckResult.overallVerification === 'verified').length,
      disputedCount: results.filter(r => r.factCheckResult.overallVerification === 'disputed').length,
      biasDistribution: {
        left: results.filter(r => r.biasAnalysis.overallBias < -1).length,
        center: results.filter(r => Math.abs(r.biasAnalysis.overallBias) <= 1).length,
        right: results.filter(r => r.biasAnalysis.overallBias > 1).length
      }
    };

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Cron] Analysis failed:', error);
    return NextResponse.json(
      { 
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}