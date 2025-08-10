#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEnhancedEvents() {
  console.log('=== CHECKING ENHANCED EVENTS ===\n');
  
  // Get events with enhanced tags
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, tags, created_at, country, severity')
    .contains('tags', ['discovery:round1'])
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`📊 Found ${events?.length || 0} events with discovery metadata\n`);
  
  // Get Round 2 events
  const { data: round2Events } = await supabase
    .from('events')
    .select('id, title, tags, created_at')
    .contains('tags', ['discovery:round2'])
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`🎯 Round 2 Events: ${round2Events?.length || 0}\n`);
  
  if (round2Events && round2Events.length > 0) {
    console.log('🟣 Sample Round 2 (Deep Search) Events:');
    round2Events.slice(0, 5).forEach(event => {
      const reliability = event.tags?.find(t => t.startsWith('reliability:'))?.split(':')[1] || 'N/A';
      console.log(`   - ${event.title.substring(0, 60)}...`);
      console.log(`     Reliability: ${reliability}%, Tags: ${event.tags?.filter(t => !t.startsWith('discovery:')).slice(0, 3).join(', ')}`);
    });
  }
  
  // Count by round
  const { count: round1Count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .contains('tags', ['discovery:round1']);
    
  const { count: round2Count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .contains('tags', ['discovery:round2']);
  
  console.log('\n📈 Two-Round Search Statistics:');
  console.log(`   - Round 1 (Broad): ${round1Count || 0} events`);
  console.log(`   - Round 2 (Targeted): ${round2Count || 0} events`);
  
  if (round1Count && round2Count) {
    const boost = ((round2Count / round1Count) * 100).toFixed(1);
    console.log(`   - Coverage Boost: ${boost}% more content discovered!`);
  }
  
  // Check reliability distribution
  const { data: allEvents } = await supabase
    .from('events')
    .select('tags')
    .or('tags.cs.{discovery:round1},tags.cs.{discovery:round2}')
    .limit(1000);
  
  if (allEvents) {
    let high = 0, medium = 0, low = 0;
    
    allEvents.forEach(event => {
      const reliabilityTag = event.tags?.find(t => t.startsWith('reliability:'));
      if (reliabilityTag) {
        const score = parseInt(reliabilityTag.split(':')[1]);
        if (score >= 80) high++;
        else if (score >= 60) medium++;
        else low++;
      }
    });
    
    console.log('\n🔍 Source Reliability Distribution:');
    console.log(`   - High (≥80%): ${high} events`);
    console.log(`   - Medium (60-79%): ${medium} events`);
    console.log(`   - Low (<60%): ${low} events`);
  }
  
  // Show total events
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📚 Total Events in Database: ${totalEvents}`);
}

checkEnhancedEvents();