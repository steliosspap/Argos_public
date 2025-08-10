#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get total count
const { count: totalCount } = await supabase
  .from('events')
  .select('*', { count: 'exact', head: true });

// Get count in last hour
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const { count: recentCount } = await supabase
  .from('events')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', oneHourAgo);

// Get ingestion status
const { data: status } = await supabase
  .from('ingestion_status')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3);

console.log('📊 Event Database Status:');
console.log(`   - Total events: ${totalCount || 0}`);
console.log(`   - Events in last hour: ${recentCount || 0}`);

console.log('\n📈 Recent Ingestion Runs:');
status?.forEach((s, i) => {
  console.log(`\n${i + 1}. ${s.status}`);
  console.log(`   - Started: ${new Date(s.created_at).toLocaleString()}`);
  console.log(`   - Articles: ${s.total_articles || 0}`);
  console.log(`   - R1 Count: ${s.round1_count || 0}`);
  console.log(`   - R2 Count: ${s.round2_count || 0}`);
});