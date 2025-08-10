/**
 * Check bias analysis data
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔍 Checking bias analysis data...\n');

// Check bias_analyses table
const { data: biasData, count: biasCount } = await supabase
  .from('bias_analyses')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(10);

console.log(`📊 Bias analyses table:`);
console.log(`   Total records: ${biasCount}`);
if (biasData && biasData.length > 0) {
  console.log(`   Recent analyses:`);
  biasData.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.article_title?.substring(0, 50)}...`);
    console.log(`      - ID: ${item.id}`);
    console.log(`      - Bias: ${item.overall_bias} (${item.bias_category})`);
    console.log(`      - Created: ${new Date(item.created_at).toLocaleString()}`);
  });
}

// Check news with bias_analysis_id
const { data: newsWithAnalysis } = await supabase
  .from('news')
  .select('*')
  .not('bias_analysis_id', 'is', null)
  .limit(5);

console.log(`\n📰 News with bias_analysis_id:`);
if (newsWithAnalysis && newsWithAnalysis.length > 0) {
  newsWithAnalysis.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_analysis_id: ${item.bias_analysis_id}`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
} else {
  console.log('   None found');
}

// Check events with bias_analysis_id
const { data: eventsWithAnalysis } = await supabase
  .from('events')
  .select('*')
  .not('bias_analysis_id', 'is', null)
  .limit(5);

console.log(`\n🎯 Events with bias_analysis_id:`);
if (eventsWithAnalysis && eventsWithAnalysis.length > 0) {
  eventsWithAnalysis.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_analysis_id: ${item.bias_analysis_id}`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
} else {
  console.log('   None found');
}

// Check news with bias_score
const { data: newsWithScore, count: newsScoreCount } = await supabase
  .from('news')
  .select('*', { count: 'exact' })
  .not('bias_score', 'is', null)
  .limit(5);

console.log(`\n📰 News with bias_score:`);
console.log(`   Total: ${newsScoreCount}`);
if (newsWithScore && newsWithScore.length > 0) {
  newsWithScore.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
}

// Check events with bias_score
const { data: eventsWithScore, count: eventsScoreCount } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .not('bias_score', 'is', null)
  .limit(5);

console.log(`\n🎯 Events with bias_score:`);
console.log(`   Total: ${eventsScoreCount}`);
if (eventsWithScore && eventsWithScore.length > 0) {
  eventsWithScore.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
}