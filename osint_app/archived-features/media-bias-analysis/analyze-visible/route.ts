import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { AnalysisPipeline } from '@/lib/analysis-pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize pipeline with configuration
const pipeline = new AnalysisPipeline({
  openaiApiKey: process.env.OPENAI_API_KEY!,
  googleSearchApiKey: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
  googleSearchEngineId: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  model: process.env.OPENAI_MODEL || 'gpt-4o'
});

export async function POST(request: NextRequest) {
  try {
    const { type, ids } = await request.json();
    
    if (!type || !ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { error: 'Invalid request. Provide type (news/events) and array of ids' },
        { status: 400 }
      );
    }

    console.log(`📊 Analyzing ${ids.length} ${type} items on-demand...`);
    
    const analyzed = [];
    const errors = [];

    // Process in small batches to avoid timeout
    const BATCH_SIZE = 5;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      
      // Fetch items from database
      const { data: items } = await supabase
        .from(type)
        .select('*')
        .in('id', batch);

      if (!items || items.length === 0) continue;

      // Analyze each item
      for (const item of items) {
        try {
          // Skip if already analyzed
          if (item.bias_analysis_id) {
            analyzed.push({ id: item.id, status: 'already_analyzed' });
            continue;
          }

          // Prepare data for analysis
          const analysisData = {
            url: type === 'news' ? item.url : item.source_url,
            title: item.title || item.headline,
            content: item.summary || item.content || '',
            source: type === 'news' ? item.source : (item.channel || item.source),
            publishedAt: type === 'news' ? item.published_at : item.timestamp
          };

          // Run analysis pipeline
          const result = await pipeline.analyze(analysisData);

          if (result) {
            // Update the item with analysis results
            await supabase
              .from(type)
              .update({
                bias_analysis_id: result.biasAnalysisId,
                bias_score: result.biasAnalysis?.overallBias,
                verification_status: result.factCheckResult?.overallVerification,
                has_analysis: true
              })
              .eq('id', item.id);

            analyzed.push({
              id: item.id,
              status: 'success',
              biasScore: result.biasAnalysis?.overallBias,
              verificationStatus: result.factCheckResult?.overallVerification
            });
          }
        } catch (error) {
          console.error(`Error analyzing item ${item.id}:`, error);
          errors.push({ id: item.id, error: error.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      analyzed: analyzed.length,
      errors: errors.length,
      results: { analyzed, errors }
    });

  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze content' },
      { status: 500 }
    );
  }
}