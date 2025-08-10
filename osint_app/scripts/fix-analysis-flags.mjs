/**
 * Fix analysis flags for items that have bias_analysis_id but not has_analysis
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

console.log('🔧 Fixing analysis flags...\n');

// Fix news items
const { data: newsToFix } = await supabase
  .from('news')
  .select('id, bias_analysis_id, has_analysis')
  .not('bias_analysis_id', 'is', null)
  .neq('has_analysis', true)
  .limit(1000);

if (newsToFix && newsToFix.length > 0) {
  console.log(`📰 Found ${newsToFix.length} news items to fix`);
  
  const { error } = await supabase
    .from('news')
    .update({ has_analysis: true })
    .in('id', newsToFix.map(item => item.id));
    
  if (error) {
    console.error('Error fixing news:', error);
  } else {
    console.log(`✅ Fixed ${newsToFix.length} news items`);
  }
}

// Fix events
const { data: eventsToFix } = await supabase
  .from('events')
  .select('id, bias_analysis_id, has_analysis')
  .not('bias_analysis_id', 'is', null)
  .neq('has_analysis', true)
  .limit(1000);

if (eventsToFix && eventsToFix.length > 0) {
  console.log(`\n🎯 Found ${eventsToFix.length} events to fix`);
  
  const { error } = await supabase
    .from('events')
    .update({ has_analysis: true })
    .in('id', eventsToFix.map(item => item.id));
    
  if (error) {
    console.error('Error fixing events:', error);
  } else {
    console.log(`✅ Fixed ${eventsToFix.length} events`);
  }
}

// Check current status
const { count: analyzedNews } = await supabase
  .from('news')
  .select('*', { count: 'exact', head: true })
  .eq('has_analysis', true);

const { count: analyzedEvents } = await supabase
  .from('events')
  .select('*', { count: 'exact', head: true })
  .eq('has_analysis', true);

console.log('\n📊 Updated Statistics:');
console.log(`   News with analysis: ${analyzedNews}`);
console.log(`   Events with analysis: ${analyzedEvents}`);

// Show some examples
const { data: exampleNews } = await supabase
  .from('news')
  .select('*')
  .eq('has_analysis', true)
  .limit(3);

const { data: exampleEvents } = await supabase
  .from('events')
  .select('*')
  .eq('has_analysis', true)
  .limit(3);

if (exampleNews && exampleNews.length > 0) {
  console.log('\n📰 Example analyzed news:');
  exampleNews.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - verification: ${item.verification_status || 'none'}`);
  });
}

if (exampleEvents && exampleEvents.length > 0) {
  console.log('\n🎯 Example analyzed events:');
  exampleEvents.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - verification: ${item.verification_status || 'none'}`);
  });
}

console.log('\n✨ Done! Check the Intelligence Center now.');