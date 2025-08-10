/**
 * Analyze any 10 unanalyzed events
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

console.log('🎯 Analyzing 10 events to demonstrate bias detection...\n');

// Get any 10 unanalyzed events with URLs
const { data: events } = await supabase
  .from('events')
  .select('*')
  .not('source_url', 'is', null)
  .or('has_analysis.is.null,has_analysis.eq.false')
  .order('timestamp', { ascending: false })
  .limit(10);

console.log(`Found ${events?.length || 0} unanalyzed events\n`);

let analyzed = 0;
for (const event of (events || [])) {
  console.log(`${analyzed + 1}. ${event.title?.substring(0, 60)}...`);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Rate bias (-5 to +5) for: "${event.title}" from ${event.channel}. JSON: {overallBias, biasCategory, confidence}`
      }],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Store analysis
    const { data: biasData } = await supabase
      .from('bias_analyses')
      .upsert({
        article_url: event.source_url,
        article_title: event.title,
        article_source: event.channel || 'Unknown',
        overall_bias: analysis.overallBias,
        bias_category: analysis.biasCategory,
        confidence: analysis.confidence || 0.7,
        analysis: analysis
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
      
      console.log(`   ✅ ${analysis.biasCategory} (${analysis.overallBias})`);
      analyzed++;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Show results
const { data: analyzedEvents, count } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .eq('has_analysis', true)
  .order('timestamp', { ascending: false })
  .limit(10);

console.log(`\n📊 Results:`);
console.log(`   Analyzed in this run: ${analyzed}`);
console.log(`   Total events with analysis: ${count}`);

if (analyzedEvents && analyzedEvents.length > 0) {
  console.log('\n🎯 Sample analyzed events:');
  analyzedEvents.slice(0, 5).forEach((event, i) => {
    const date = new Date(event.timestamp).toLocaleDateString();
    console.log(`   ${i + 1}. ${event.title?.substring(0, 45)}...`);
    console.log(`      Bias: ${event.bias_score} | Date: ${date} | ${event.channel}`);
  });
}

console.log('\n✨ Open the Intelligence Center and check the Timeline tab!');
console.log('🔍 Look for the bias indicators next to event titles.');