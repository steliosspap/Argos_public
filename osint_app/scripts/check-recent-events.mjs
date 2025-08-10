#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRecentEvents() {
  console.log('=== CHECKING RECENT EVENTS ===\n');
  
  // Get most recent events
  const { data: events, error, count } = await supabase
    .from('events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`📊 Total Events: ${count}\n`);
  
  if (events && events.length > 0) {
    console.log('🗞️  Most Recent Events:');
    events.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   - Created: ${new Date(event.created_at).toLocaleString()}`);
      console.log(`   - Country: ${event.country}`);
      console.log(`   - Severity: ${event.severity}`);
      console.log(`   - Tags: ${event.tags?.slice(0, 5).join(', ') || 'None'}`);
      
      // Check for enhanced metadata in tags
      const hasDiscoveryTag = event.tags?.some(t => t.startsWith('discovery:'));
      const hasReliabilityTag = event.tags?.some(t => t.startsWith('reliability:'));
      
      if (hasDiscoveryTag || hasReliabilityTag) {
        console.log(`   🌟 Enhanced: ${hasDiscoveryTag ? 'Has discovery round' : ''} ${hasReliabilityTag ? 'Has reliability score' : ''}`);
      }
    });
  } else {
    console.log('No events found in database');
  }
  
  // Check for events created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count: todayCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  
  console.log(`\n📅 Events Created Today: ${todayCount || 0}`);
}

checkRecentEvents();