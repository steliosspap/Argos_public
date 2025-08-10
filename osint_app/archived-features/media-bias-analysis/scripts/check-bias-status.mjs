/**
 * Check the current status of bias analysis
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

console.log('🔍 Checking bias analysis status...\n');

// Check recent news
const { data: recentNews, count: newsCount } = await supabase
  .from('news')
  .select('*', { count: 'exact' })
  .gte('published_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
  .order('published_at', { ascending: false })
  .limit(10);

// Check recent events
const { data: recentEvents, count: eventsCount } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  .not('source_url', 'is', null)
  .order('timestamp', { ascending: false })
  .limit(10);

console.log('📰 Recent News (last 48 hours):');
console.log(`   Total: ${newsCount}`);
console.log(`   Sample of 10:`);
recentNews?.forEach((item, i) => {
  console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
  console.log(`      - has_analysis: ${item.has_analysis || false}`);
  console.log(`      - bias_score: ${item.bias_score ?? 'null'}`);
  console.log(`      - verification: ${item.verification_status || 'none'}`);
});

console.log('\n🎯 Recent Events (last 7 days with URLs):');
console.log(`   Total: ${eventsCount}`);
console.log(`   Sample of 10:`);
recentEvents?.forEach((item, i) => {
  console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
  console.log(`      - has_analysis: ${item.has_analysis || false}`);
  console.log(`      - bias_score: ${item.bias_score ?? 'null'}`);
  console.log(`      - verification: ${item.verification_status || 'none'}`);
});

// Get counts
const { count: analyzedNewsCount } = await supabase
  .from('news')
  .select('*', { count: 'exact', head: true })
  .eq('has_analysis', true);

const { count: analyzedEventsCount } = await supabase
  .from('events')
  .select('*', { count: 'exact', head: true })
  .eq('has_analysis', true);

console.log('\n📊 Overall Statistics:');
console.log(`   News with analysis: ${analyzedNewsCount}`);
console.log(`   Events with analysis: ${analyzedEventsCount}`);

console.log('\n✨ The bias indicators should appear in the Intelligence Center for analyzed items.');