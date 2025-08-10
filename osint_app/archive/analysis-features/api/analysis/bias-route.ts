import { NextRequest, NextResponse } from 'next/server';
import { AnalysisPipeline } from '@/lib/analysis-pipeline';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Maximum execution time for Vercel
export const maxDuration = 60;

/**
 * POST /api/analysis/bias
 * Analyze a single article for bias and fact-checking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.content || !body.url) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, or url' },
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

    // Analyze the article
    const result = await pipeline.analyzeArticle({
      id: body.id,
      title: body.title,
      content: body.content,
      source: body.source || 'Unknown',
      url: body.url,
      publishedDate: body.publishedDate,
      language: body.language
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Bias analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analysis/bias?url=<article_url>
 * Get existing bias analysis for an article
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Initialize analysis pipeline
    const pipeline = new AnalysisPipeline({
      openaiApiKey: process.env.OPENAI_API_KEY!,
      googleApiKey: process.env.GOOGLE_API_KEY!,
      googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID!,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    });

    // Get cached analysis
    const result = await pipeline.getAnalysisForArticle(url);

    if (!result) {
      return NextResponse.json(
        { error: 'No analysis found for this URL' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}