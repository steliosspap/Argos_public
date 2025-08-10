#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔍 Verifying Enhanced Tags Implementation\n');

// Get all events and check their tags
const { data: events, error } = await supabase
  .from('events')
  .select('id, title, tags, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

console.log(`📊 Checking ${events?.length || 0} most recent events...\n`);

let enhancedCount = 0;

events?.forEach((event, i) => {
  const discoveryTag = event.tags?.find(t => t?.startsWith('discovery:'));
  const reliabilityTag = event.tags?.find(t => t?.startsWith('reliability:'));
  
  if (discoveryTag || reliabilityTag) {
    enhancedCount++;
    console.log(`✨ Event ${i + 1}: ${event.title}`);
    console.log(`   - Created: ${new Date(event.created_at).toLocaleString()}`);
    console.log(`   - Discovery: ${discoveryTag || 'Missing'}`);
    console.log(`   - Reliability: ${reliabilityTag || 'Missing'}`);
    console.log(`   - All tags: ${event.tags?.slice(0, 5).join(', ')}${event.tags?.length > 5 ? '...' : ''}\n`);
  }
});

if (enhancedCount === 0) {
  console.log('❌ No events with enhanced tags found');
  console.log('\nSample tags from recent events:');
  events?.slice(0, 3).forEach((event, i) => {
    console.log(`${i + 1}. ${event.title}`);
    console.log(`   Tags: ${event.tags?.join(', ') || 'None'}\n`);
  });
} else {
  console.log(`\n✅ Found ${enhancedCount} events with enhanced metadata!`);
}

// Check ingestion status
const { data: status } = await supabase
  .from('ingestion_status')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (status) {
  console.log('\n📈 Latest Ingestion Status:');
  console.log(`   - Status: ${status.status}`);
  console.log(`   - Started: ${new Date(status.created_at).toLocaleString()}`);
  console.log(`   - Articles: ${status.total_articles || 0}`);
}