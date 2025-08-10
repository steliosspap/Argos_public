/**
 * Verify has_analysis column exists and update analyzed items
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

console.log('🔍 Verifying and updating analysis data...\n');

// Try to update has_analysis for news
try {
  const { data: newsUpdated, error } = await supabase
    .from('news')
    .update({ has_analysis: true })
    .not('bias_score', 'is', null)
    .select('id, title, bias_score, has_analysis');
    
  if (error) {
    console.error('❌ Error updating news:', error.message);
    console.log('   Please run the migration: database/migrations/add_has_analysis_only.sql');
  } else {
    console.log(`✅ Updated ${newsUpdated?.length || 0} news items with has_analysis=true`);
    if (newsUpdated && newsUpdated.length > 0) {
      console.log('   Sample updated news:');
      newsUpdated.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}... (bias: ${item.bias_score})`);
      });
    }
  }
} catch (e) {
  console.error('❌ Failed to update news:', e.message);
}

// Try to update has_analysis for events
try {
  const { data: eventsUpdated, error } = await supabase
    .from('events')
    .update({ has_analysis: true })
    .not('bias_score', 'is', null)
    .select('id, title, bias_score, has_analysis');
    
  if (error) {
    console.error('❌ Error updating events:', error.message);
  } else {
    console.log(`\n✅ Updated ${eventsUpdated?.length || 0} events with has_analysis=true`);
    if (eventsUpdated && eventsUpdated.length > 0) {
      console.log('   Sample updated events:');
      eventsUpdated.slice(0, 3).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}... (bias: ${item.bias_score})`);
      });
    }
  }
} catch (e) {
  console.error('❌ Failed to update events:', e.message);
}

// Check current status
const { data: newsWithAnalysis, count: newsCount } = await supabase
  .from('news')
  .select('*', { count: 'exact' })
  .eq('has_analysis', true)
  .limit(5);

const { data: eventsWithAnalysis, count: eventsCount } = await supabase
  .from('events')
  .select('*', { count: 'exact' })
  .eq('has_analysis', true)
  .limit(5);

console.log('\n📊 Current Status:');
console.log(`   News with analysis: ${newsCount || 0}`);
console.log(`   Events with analysis: ${eventsCount || 0}`);

if (newsWithAnalysis && newsWithAnalysis.length > 0) {
  console.log('\n📰 Sample analyzed news:');
  newsWithAnalysis.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
}

if (eventsWithAnalysis && eventsWithAnalysis.length > 0) {
  console.log('\n🎯 Sample analyzed events:');
  eventsWithAnalysis.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
}

console.log('\n✨ If the migration has been run, bias indicators should now appear in the Intelligence Center!');
console.log('📝 If not, please run: database/migrations/add_has_analysis_only.sql in Supabase SQL editor.');