/**
 * Show event details to understand the data
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

console.log('🔍 Checking event data structure...\n');

// Get a few recent events
const { data: events } = await supabase
  .from('events')
  .select('*')
  .order('timestamp', { ascending: false })
  .limit(3);

console.log('📊 Sample events:');
events?.forEach((event, i) => {
  console.log(`\n${i + 1}. Event ID: ${event.id}`);
  console.log(`   Title: ${event.title}`);
  console.log(`   Summary: ${event.summary?.substring(0, 100)}...`);
  console.log(`   Channel: ${event.channel}`);
  console.log(`   Country: ${event.country}`);
  console.log(`   Source URL: ${event.source_url}`);
  console.log(`   Timestamp: ${new Date(event.timestamp).toLocaleString()}`);
  console.log(`   Has Analysis: ${event.has_analysis}`);
  console.log(`   Bias Score: ${event.bias_score}`);
});

// Check news items
const { data: news } = await supabase
  .from('news')
  .select('*')
  .order('date', { ascending: false })
  .limit(3);

console.log('\n\n📰 Sample news:');
news?.forEach((item, i) => {
  console.log(`\n${i + 1}. News ID: ${item.id}`);
  console.log(`   Title: ${item.title}`);
  console.log(`   Source: ${item.source}`);
  console.log(`   Date: ${new Date(item.date).toLocaleString()}`);
  console.log(`   Has Analysis: ${item.has_analysis}`);
  console.log(`   Bias Score: ${item.bias_score}`);
});