/**
 * Quick analysis of remaining unanalyzed items
 * Run with: node scripts/analyze-remaining.mjs
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

// Quick analysis of just the Moscow Times articles
const { data: moscowTimesNews } = await supabase
  .from('news')
  .select('*')
  .is('bias_analysis_id', null)
  .eq('source', 'https://www.themoscowtimes.com/rss/news')
  .limit(5);

console.log(`Analyzing ${moscowTimesNews?.length || 0} Moscow Times articles...`);

for (const item of (moscowTimesNews || [])) {
  console.log(`\n${item.title}`);
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Rate bias (-5 to +5): "${item.title}" from Moscow Times. Return JSON: {overallBias, biasCategory, confidence}`
      }],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Quick store
    const { data: biasData } = await supabase
      .from('bias_analyses')
      .upsert({
        article_url: item.url,
        article_title: item.title,
        article_source: item.source,
        overall_bias: analysis.overallBias,
        bias_category: analysis.biasCategory,
        confidence: analysis.confidence || 0.7,
        analysis: analysis
      })
      .select()
      .single();

    if (biasData) {
      await supabase
        .from('news')
        .update({
          bias_analysis_id: biasData.id,
          bias_score: analysis.overallBias
        })
        .eq('id', item.id);
      
      console.log(`✅ ${analysis.biasCategory} (${analysis.overallBias})`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n✅ Done! Check the Intelligence Center now.');