import { NextRequest, NextResponse } from 'next/server';
import { AnalysisPipeline } from '@/lib/analysis-pipeline';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum execution time for Vercel
export const maxDuration = 300; // 5 minutes for batch processing

/**
 * POST /api/analysis/batch
 * Analyze multiple unanalyzed articles from the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 10;

    // Validate limit
    if (limit > 50) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 50 articles per batch' },
        { status: 400 }
      );
    }

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

    // Analyze unanalyzed news from database
    const results = await pipeline.analyzeNewsFromDatabase(limit);

    return NextResponse.json({
      success: true,
      analyzed: results.length,
      data: results
    });

  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Batch analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}