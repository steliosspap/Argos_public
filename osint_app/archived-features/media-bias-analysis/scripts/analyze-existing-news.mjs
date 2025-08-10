/**
 * Analyze existing news items in the database
 * Run with: node scripts/analyze-existing-news.mjs [--limit 10]
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

// Parse command line arguments
const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1]) : 5;

console.log(`🔍 Analyzing up to ${limit} existing news items...\n`);

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

async function analyzeExistingNews() {
  // Fetch unanalyzed news items
  const { data: newsItems, error } = await supabase
    .from('news_with_sources')
    .select('*')
    .is('bias_analysis_id', null)
    .limit(limit)
    .order('published_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch news:', error.message);
    return;
  }

  if (!newsItems || newsItems.length === 0) {
    console.log('ℹ️  No unanalyzed news items found.');
    console.log('   All news may already be analyzed, or the database may be empty.');
    return;
  }

  console.log(`Found ${newsItems.length} unanalyzed news items.\n`);

  for (const item of newsItems) {
    console.log(`\n📰 Analyzing: "${item.title}"`);
    console.log(`   Source: ${item.source || 'Unknown'}`);
    console.log(`   Published: ${new Date(item.published_at).toLocaleString()}`);
    
    try {
      // Simple bias analysis
      const biasPrompt = `Analyze this news article for political bias. Rate from -5 (far left) to +5 (far right).

Title: ${item.title}
Summary: ${item.summary || item.content || 'No content available'}
Source: ${item.source || 'Unknown'}

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

      const analysis = JSON.parse(response.choices[0].message.content);
      
      console.log(`   ✅ Analysis complete:`);
      console.log(`      • Bias: ${analysis.overallBias} (${analysis.biasCategory})`);
      console.log(`      • Confidence: ${Math.round(analysis.confidence * 100)}%`);
      console.log(`      • Sensationalism: ${Math.round(analysis.sensationalism * 100)}%`);
      
      // Store the analysis
      const { data: biasData, error: biasError } = await supabase
        .from('bias_analyses')
        .upsert({
          article_url: item.url,
          article_title: item.title,
          article_source: item.source,
          overall_bias: analysis.overallBias,
          bias_category: analysis.biasCategory,
          political_bias: analysis.overallBias / 5, // Normalize to -1 to 1
          sensationalism_score: analysis.sensationalism,
          emotional_language_score: analysis.sensationalism * 0.8, // Estimate
          source_balance_score: 0.5, // Default without full analysis
          fact_selection_bias: 0, // Default without full analysis
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

      if (biasError) {
        console.error(`      ❌ Failed to store analysis: ${biasError.message}`);
      } else {
        // Update the news item with the analysis reference
        const { error: updateError } = await supabase
          .from('news')
          .update({
            bias_analysis_id: biasData.id,
            bias_score: analysis.overallBias
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`      ❌ Failed to update news item: ${updateError.message}`);
        } else {
          console.log(`      ✅ Analysis stored successfully`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
}

// Run the analysis
console.log('🚀 Starting analysis...\n');
await analyzeExistingNews();
console.log('\n✅ Analysis complete!');
console.log('\n💡 View the results in the Intelligence Center at:');
console.log('   http://localhost:3000/intelligence-center');