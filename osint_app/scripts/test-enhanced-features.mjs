#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testEnhancedFeatures() {
  console.log('=== TESTING ENHANCED INGESTION FEATURES ===\n');
  
  // Check for events with enhanced metadata
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .not('discovery_round', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${events?.length || 0} events with discovery_round metadata\n`);
  
  if (events && events.length > 0) {
    console.log('🔍 Sample Enhanced Events:');
    events.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   - Discovery Round: ${event.discovery_round === 2 ? '🟣 Round 2 (Deep Search)' : '🔵 Round 1 (Broad Search)'}`);
      console.log(`   - Source Reliability: ${event.source_reliability ? `${(event.source_reliability * 100).toFixed(0)}%` : 'Not set'}`);
      console.log(`   - Location: ${event.country}${event.city ? `, ${event.city}` : ''}`);
      console.log(`   - Severity: ${event.severity}`);
      console.log(`   - Created: ${new Date(event.created_at).toLocaleString()}`);
    });
  }
  
  // Check two-round effectiveness
  const { data: round1Count } = await supabase
    .from('events')
    .select('id', { count: 'exact' })
    .eq('discovery_round', 1);
    
  const { data: round2Count } = await supabase
    .from('events')
    .select('id', { count: 'exact' })
    .eq('discovery_round', 2);
  
  console.log('\n📊 Two-Round Search Effectiveness:');
  console.log(`   - Round 1 Events: ${round1Count?.length || 0}`);
  console.log(`   - Round 2 Events: ${round2Count?.length || 0}`);
  
  if (round1Count?.length && round2Count?.length) {
    const boost = ((round2Count.length / round1Count.length) * 100).toFixed(1);
    console.log(`   - Coverage Boost: ${boost}% more content discovered!`);
  }
  
  // Check source reliability distribution
  const { data: sources } = await supabase
    .from('events')
    .select('source_reliability')
    .not('source_reliability', 'is', null);
  
  if (sources && sources.length > 0) {
    const highReliability = sources.filter(s => s.source_reliability >= 0.8).length;
    const medReliability = sources.filter(s => s.source_reliability >= 0.6 && s.source_reliability < 0.8).length;
    const lowReliability = sources.filter(s => s.source_reliability < 0.6).length;
    
    console.log('\n📈 Source Reliability Distribution:');
    console.log(`   - High (≥80%): ${highReliability} events`);
    console.log(`   - Medium (60-79%): ${medReliability} events`);
    console.log(`   - Low (<60%): ${lowReliability} events`);
  }
}

testEnhancedFeatures();