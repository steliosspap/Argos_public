/**
 * Properly analyze recent events with actual titles
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

console.log('🎯 Analyzing recent events with proper content...\n');

// Get recent events that have actual news titles (not generic)
const { data: events } = await supabase
  .from('events')
  .select('*')
  .not('source_url', 'is', null)
  .or('has_analysis.is.null,has_analysis.eq.false')
  .not('title', 'like', '%Sudan Tribune - Plural news%')
  .not('title', 'like', '%Russia-Ukraine war | Today%')
  .not('title', 'like', '%All news about%')
  .order('timestamp', { ascending: false })
  .limit(10);

console.log(`Found ${events?.length || 0} events with specific titles\n`);

let analyzed = 0;
for (const event of (events || [])) {
  console.log(`\nAnalyzing: ${event.title?.substring(0, 70)}...`);
  console.log(`   Channel: ${event.channel} | Country: ${event.country}`);
  
  try {
    const prompt = `Analyze the political bias of this news event:
Title: ${event.title}
Summary: ${event.summary || 'No summary'}
Source: ${event.channel}
Country: ${event.country}

Rate the bias from -5 (far-left) to +5 (far-right). Consider the source, framing, and language used.
Return JSON: {overallBias: number, biasCategory: string, confidence: number}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Store detailed analysis
    const { data: biasData } = await supabase
      .from('bias_analyses')
      .upsert({
        article_url: event.source_url,
        article_title: event.title,
        article_source: event.channel || 'Unknown',
        overall_bias: analysis.overallBias,
        bias_category: analysis.biasCategory,
        political_bias: analysis.overallBias / 5,
        sensationalism_score: 0.5,
        emotional_language_score: 0.5,
        source_balance_score: 0.5,
        fact_selection_bias: 0,
        confidence: analysis.confidence || 0.7,
        analysis: {
          ...analysis,
          biasTypes: {
            political: analysis.overallBias / 5,
            sensationalism: 0.5,
            emotionalLanguage: 0.5,
            sourceBalance: 0.5,
            factSelection: 0
          }
        }
      })
      .select()
      .single();

    if (biasData) {
      await supabase
        .from('events')
        .update({
          bias_analysis_id: biasData.id,
          bias_score: analysis.overallBias,
          has_analysis: true
        })
        .eq('id', event.id);
      
      console.log(`   ✅ Analysis: ${analysis.biasCategory} (${analysis.overallBias})`);
      analyzed++;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Show all analyzed events
const { data: allAnalyzed, count } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .eq('has_analysis', true)
  .order('timestamp', { ascending: false })
  .limit(10);

console.log(`\n\n📊 Summary:`);
console.log(`   Analyzed in this run: ${analyzed}`);
console.log(`   Total events with analysis: ${count}`);

if (allAnalyzed && allAnalyzed.length > 0) {
  console.log('\n🎯 Events with bias indicators (will show in Timeline):');
  allAnalyzed.forEach((event, i) => {
    const time = new Date(event.timestamp).toLocaleString();
    console.log(`\n   ${i + 1}. ${event.title?.substring(0, 60)}...`);
    console.log(`      Bias Score: ${event.bias_score} | Time: ${time}`);
    console.log(`      Location: ${event.country} | Channel: ${event.channel}`);
  });
}

console.log('\n\n✨ NEXT STEPS:');
console.log('1. Open the Intelligence Center');
console.log('2. Go to the Timeline tab');
console.log('3. Look for the events listed above - they should have bias indicators');
console.log('\nThe bias indicators appear as small badges showing the bias score and political leaning.');