/**
 * Update has_analysis field for items with bias data
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

console.log('🔧 Updating has_analysis field...\n');

// Update news items with bias_score but no has_analysis flag
const { data: newsUpdated, error: newsError } = await supabase
  .from('news')
  .update({ has_analysis: true })
  .not('bias_score', 'is', null)
  .select();

if (newsError) {
  console.error('Error updating news:', newsError);
} else {
  console.log(`✅ Updated ${newsUpdated?.length || 0} news items with has_analysis=true`);
}

// Update events with bias_score but no has_analysis flag
const { data: eventsUpdated, error: eventsError } = await supabase
  .from('events')
  .update({ has_analysis: true })
  .not('bias_score', 'is', null)
  .select();

if (eventsError) {
  console.error('Error updating events:', eventsError);
} else {
  console.log(`✅ Updated ${eventsUpdated?.length || 0} events with has_analysis=true`);
}

// Verify the update
const { data: verifyNews } = await supabase
  .from('news')
  .select('*')
  .eq('has_analysis', true)
  .limit(5);

console.log('\n📰 Sample news with has_analysis=true:');
verifyNews?.forEach((item, i) => {
  console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
  console.log(`      - bias_score: ${item.bias_score}`);
  console.log(`      - has_analysis: ${item.has_analysis}`);
});

const { data: verifyEvents } = await supabase
  .from('events')
  .select('*')
  .eq('has_analysis', true)
  .limit(5);

console.log('\n🎯 Sample events with has_analysis=true:');
if (verifyEvents && verifyEvents.length > 0) {
  verifyEvents.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`      - bias_score: ${item.bias_score}`);
    console.log(`      - has_analysis: ${item.has_analysis}`);
  });
} else {
  console.log('   No events with analysis found');
}

console.log('\n✨ Done! The bias indicators should now appear in the Intelligence Center.');