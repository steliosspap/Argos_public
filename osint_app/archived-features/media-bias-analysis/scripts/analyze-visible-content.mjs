/**
 * Analyze only visible content in the Intelligence Center
 * This script fetches and analyzes only the events/news that would be displayed to users
 * Run with: node scripts/analyze-visible-content.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

console.log('🔍 Analyzing visible content in Intelligence Center...\n');

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
- sensationalism: 0 to 1`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'user', content: biasPrompt }],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`Failed to analyze: ${error.message}`);
    return null;
  }
}

// 1. Analyze recent news (Headlines tab - typically shows last 48 hours)
console.log('📰 Analyzing recent news for Headlines tab...');
const recentDate = new Date();
recentDate.setHours(recentDate.getHours() - 48);

const { data: visibleNews } = await supabase
  .from('news')
  .select('*')
  .gte('published_at', recentDate.toISOString())
  .is('bias_analysis_id', null)
  .order('published_at', { ascending: false })
  .limit(50); // Typical visible limit in UI

console.log(`Found ${visibleNews?.length || 0} recent unanalyzed news items\n`);

let newsAnalyzed = 0;
for (const item of (visibleNews || [])) {
  console.log(`📰 ${item.title?.substring(0, 60)}...`);
  
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
        bias_score: analysis.overallBias,
        has_analysis: true
      })
      .eq('id', item.id);
    
    newsAnalyzed++;
    console.log(`  ✅ ${analysis.biasCategory} (${analysis.overallBias})`);
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}

// 2. Analyze recent events (Timeline tab - typically shows last 7 days)
console.log('\n\n🎯 Analyzing recent events for Timeline...');
const eventDate = new Date();
eventDate.setDate(eventDate.getDate() - 7);

const { data: visibleEvents } = await supabase
  .from('events')
  .select('*')
  .gte('timestamp', eventDate.toISOString())
  .is('bias_analysis_id', null)
  .not('source_url', 'is', null)
  .order('timestamp', { ascending: false })
  .limit(100); // Typical visible limit

console.log(`Found ${visibleEvents?.length || 0} recent unanalyzed events with URLs\n`);

let eventsAnalyzed = 0;
for (const event of (visibleEvents || [])) {
  console.log(`🎯 ${event.title?.substring(0, 60)}...`);
  
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
        bias_score: analysis.overallBias,
        has_analysis: true
      })
      .eq('id', event.id);
    
    eventsAnalyzed++;
    console.log(`  ✅ ${analysis.biasCategory} (${analysis.overallBias})`);
  }

  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n\n📊 Analysis Summary:');
console.log(`   • News items analyzed: ${newsAnalyzed}`);
console.log(`   • Events analyzed: ${eventsAnalyzed}`);
console.log(`   • Total analyzed: ${newsAnalyzed + eventsAnalyzed}`);

console.log('\n✅ Analysis complete!');
console.log('\n💡 The bias indicators should now appear in the Intelligence Center.');
console.log('   - Check the Headlines tab for news bias indicators');
console.log('   - Check the Timeline tab for event bias indicators');