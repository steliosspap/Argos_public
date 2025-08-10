/**
 * Analyze all unanalyzed news and events
 * Run with: node scripts/analyze-all-content.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

console.log('🔍 Starting comprehensive content analysis...\n');

async function analyzeContent(item, type = 'news') {
  try {
    const biasPrompt = `Analyze this ${type} content for political bias. Rate from -5 (far left) to +5 (far right).

Title: ${item.title}
Content: ${item.summary || item.content || 'No content available'}
Source: ${item.source || item.channel || 'Unknown'}

Provide a JSON response with:
- overallBias: number from -5 to 5
- biasCategory: "far-left", "left", "lean-left", "center", "lean-right", "right", or "far-right"
- confidence: 0 to 1
- sensationalism: 0 to 1
- explanation: brief explanation`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: biasPrompt }],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`Failed to analyze: ${error.message}`);
    return null;
  }
}

// Analyze news items
console.log('📰 Analyzing news items...');
const { data: unanalyzedNews } = await supabase
  .from('news')
  .select('*')
  .is('bias_analysis_id', null)
  .limit(50)
  .order('published_at', { ascending: false });

console.log(`Found ${unanalyzedNews?.length || 0} unanalyzed news items\n`);

let newsAnalyzed = 0;
for (const item of (unanalyzedNews || [])) {
  console.log(`Analyzing: ${item.title?.substring(0, 60)}...`);
  
  const analysis = await analyzeContent(item, 'news');
  if (!analysis) continue;

  // Store analysis
  const { data: biasData } = await supabase
    .from('bias_analyses')
    .upsert({
      article_url: item.url,
      article_title: item.title,
      article_source: item.source,
      overall_bias: analysis.overallBias,
      bias_category: analysis.biasCategory,
      political_bias: analysis.overallBias / 5,
      sensationalism_score: analysis.sensationalism,
      emotional_language_score: analysis.sensationalism * 0.8,
      source_balance_score: 0.5,
      fact_selection_bias: 0,
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      analysis: {
        overallBias: analysis.overallBias,
        biasCategory: analysis.biasCategory,
        biasTypes: {
          political: analysis.overallBias / 5,
          sensationalism: analysis.sensationalism,
          emotionalLanguage: analysis.sensationalism * 0.8,
          sourceBalance: 0.5,
          factSelection: 0
        },
        indicators: [],
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        highlightedPhrases: []
      }
    })
    .select()
    .single();

  if (biasData) {
    // Update news item
    await supabase
      .from('news')
      .update({
        bias_analysis_id: biasData.id,
        bias_score: analysis.overallBias
      })
      .eq('id', item.id);
    
    newsAnalyzed++;
    console.log(`  ✅ ${analysis.biasCategory} (${analysis.overallBias})`);
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Analyze events
console.log('\n\n🎯 Analyzing events...');
const { data: unanalyzedEvents } = await supabase
  .from('events')
  .select('*')
  .is('bias_analysis_id', null)
  .not('source_url', 'is', null)
  .limit(30)
  .order('timestamp', { ascending: false });

console.log(`Found ${unanalyzedEvents?.length || 0} unanalyzed events with URLs\n`);

let eventsAnalyzed = 0;
for (const event of (unanalyzedEvents || [])) {
  console.log(`Analyzing: ${event.title?.substring(0, 60)}...`);
  
  const analysis = await analyzeContent(event, 'event');
  if (!analysis) continue;

  // Store analysis
  const { data: biasData } = await supabase
    .from('bias_analyses')
    .upsert({
      article_url: event.source_url,
      article_title: event.title,
      article_source: event.channel || event.source,
      overall_bias: analysis.overallBias,
      bias_category: analysis.biasCategory,
      political_bias: analysis.overallBias / 5,
      sensationalism_score: analysis.sensationalism,
      emotional_language_score: analysis.sensationalism * 0.8,
      source_balance_score: 0.5,
      fact_selection_bias: 0,
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      analysis: {
        overallBias: analysis.overallBias,
        biasCategory: analysis.biasCategory,
        biasTypes: {
          political: analysis.overallBias / 5,
          sensationalism: analysis.sensationalism,
          emotionalLanguage: analysis.sensationalism * 0.8,
          sourceBalance: 0.5,
          factSelection: 0
        },
        indicators: [],
        confidence: analysis.confidence,
        explanation: analysis.explanation,
        highlightedPhrases: []
      }
    })
    .select()
    .single();

  if (biasData) {
    // Update event
    await supabase
      .from('events')
      .update({
        bias_analysis_id: biasData.id,
        bias_score: analysis.overallBias
      })
      .eq('id', event.id);
    
    eventsAnalyzed++;
    console.log(`  ✅ ${analysis.biasCategory} (${analysis.overallBias})`);
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log('\n\n📊 Analysis Summary:');
console.log(`   • News items analyzed: ${newsAnalyzed}`);
console.log(`   • Events analyzed: ${eventsAnalyzed}`);
console.log(`   • Total analyzed: ${newsAnalyzed + eventsAnalyzed}`);

console.log('\n✅ Analysis complete!');
console.log('\n💡 The bias indicators should now appear in the Intelligence Center.');