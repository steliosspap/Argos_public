/**
 * Quick analysis of 10 recent events to demonstrate the system
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

console.log('🎯 Analyzing 10 recent events to demonstrate bias detection...\n');

// Get 10 recent events
const { data: recentEvents } = await supabase
  .from('events')
  .select('*')
  .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  .not('source_url', 'is', null)
  .is('has_analysis', null)
  .order('timestamp', { ascending: false })
  .limit(10);

console.log(`Found ${recentEvents?.length || 0} recent unanalyzed events\n`);

for (const event of (recentEvents || [])) {
  console.log(`Analyzing: ${event.title?.substring(0, 60)}...`);
  
  try {
    // Quick bias analysis
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Analyze bias for: "${event.title}" from ${event.channel}. Return JSON with: {overallBias: -5 to 5, biasCategory: "far-left"/"left"/"lean-left"/"center"/"lean-right"/"right"/"far-right", confidence: 0-1}`
      }],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Store analysis
    const { data: biasData } = await supabase
      .from('bias_analyses')
      .upsert({
        article_url: event.source_url,
        article_title: event.title,
        article_source: event.channel || event.source,
        overall_bias: analysis.overallBias,
        bias_category: analysis.biasCategory,
        confidence: analysis.confidence || 0.7,
        analysis: analysis
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
      
      console.log(`  ✅ ${analysis.biasCategory} (${analysis.overallBias})`);
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  
  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Check results
const { data: analyzedEvents, count } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .eq('has_analysis', true)
  .order('timestamp', { ascending: false })
  .limit(5);

console.log(`\n📊 Analysis Complete:`);
console.log(`   Total events with analysis: ${count}`);

if (analyzedEvents && analyzedEvents.length > 0) {
  console.log('\n🎯 Recently analyzed events:');
  analyzedEvents.forEach((event, i) => {
    console.log(`   ${i + 1}. ${event.title?.substring(0, 50)}...`);
    console.log(`      - Bias: ${event.bias_score} | Channel: ${event.channel}`);
  });
}

console.log('\n✨ Check the Intelligence Center now - bias indicators should appear on the Timeline tab!');