#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testEventsAPI() {
  console.log('🔍 Testing events API query...\n');

  try {
    // Test the exact query from the API
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    console.log(`📅 Querying events from: ${sixtyDaysAgo.toISOString()}`);
    
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('timestamp', sixtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (eventsError) {
      console.error('❌ Query error:', eventsError);
      return;
    }

    console.log(`✅ Raw query returned: ${eventsData?.length || 0} events\n`);

    // Check coordinate validity
    const validEvents = (eventsData || []).filter(item => {
      const lat = item.latitude;
      const lng = item.longitude;
      return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && 
             lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });

    console.log(`📍 Valid coordinates: ${validEvents.length} events`);

    // Check temporal distribution
    const now = new Date();
    const stats = {
      last24h: validEvents.filter(e => new Date(e.timestamp) > new Date(now.getTime() - 24 * 60 * 60 * 1000)).length,
      last7d: validEvents.filter(e => new Date(e.timestamp) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length,
      last30d: validEvents.filter(e => new Date(e.timestamp) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length,
      older: validEvents.filter(e => new Date(e.timestamp) <= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length
    };

    console.log('\n📊 Temporal distribution:');
    console.log(`  - Last 24h: ${stats.last24h} events`);
    console.log(`  - Last 7d: ${stats.last7d} events`);
    console.log(`  - Last 30d: ${stats.last30d} events`);
    console.log(`  - Older: ${stats.older} events`);

    // Show sample events
    console.log('\n📋 Sample recent events:');
    validEvents.slice(0, 5).forEach(event => {
      const age = Math.floor((now - new Date(event.timestamp)) / (1000 * 60 * 60));
      console.log(`  - ${event.title || event.summary}`);
      console.log(`    📍 [${event.latitude}, ${event.longitude}] - ${event.country || 'Unknown'}`);
      console.log(`    🕐 ${age} hours ago (${new Date(event.timestamp).toLocaleDateString()})`);
    });

    // Test without time filter
    const { data: allEvents, error: allError } = await supabase
      .from('events')
      .select('id, latitude, longitude, timestamp')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (!allError) {
      console.log(`\n📊 Total events with coordinates (no time filter): ${allEvents?.length || 0}`);
      if (allEvents && allEvents.length > 0) {
        const newest = new Date(allEvents[0].timestamp);
        const oldest = new Date(allEvents[allEvents.length - 1].timestamp);
        console.log(`  - Newest: ${newest.toLocaleDateString()} (${Math.floor((now - newest) / (1000 * 60 * 60 * 24))} days ago)`);
        console.log(`  - Oldest in batch: ${oldest.toLocaleDateString()} (${Math.floor((now - oldest) / (1000 * 60 * 60 * 24))} days ago)`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testEventsAPI().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
});