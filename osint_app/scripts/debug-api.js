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

async function debugAPI() {
  console.log('🔍 Debugging events API...\n');

  try {
    // 1. Check total events in database
    const { count: totalCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total events in database: ${totalCount}`);

    // 2. Check events with coordinates
    const { data: withCoords, count: coordsCount } = await supabase
      .from('events')
      .select('id', { count: 'exact' })
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    
    console.log(`📍 Events with coordinates: ${coordsCount}`);

    // 3. Check events from last 60 days with coordinates
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const { data: recentWithCoords, count: recentCount } = await supabase
      .from('events')
      .select('id', { count: 'exact' })
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('timestamp', sixtyDaysAgo.toISOString());
    
    console.log(`📅 Events from last 60 days with coordinates: ${recentCount}`);
    console.log(`   (Query date: ${sixtyDaysAgo.toISOString()})`);

    // 4. Get sample of actual data
    const { data: sample } = await supabase
      .from('events')
      .select('id, title, latitude, longitude, timestamp, severity, country')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(10);

    console.log('\n📋 Sample events with coordinates:');
    sample?.forEach((event, i) => {
      console.log(`${i + 1}. ${event.title || 'Untitled'}`);
      console.log(`   📍 [${event.latitude}, ${event.longitude}] - ${event.country}`);
      console.log(`   🕐 ${event.timestamp}`);
    });

    // 5. Check date range of events
    const { data: dateRange } = await supabase
      .from('events')
      .select('timestamp')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(1);
    
    const { data: oldestDate } = await supabase
      .from('events')
      .select('timestamp')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('timestamp', { ascending: true })
      .limit(1);

    if (dateRange && oldestDate) {
      console.log('\n📅 Date range of events with coordinates:');
      console.log(`   Newest: ${dateRange[0].timestamp}`);
      console.log(`   Oldest: ${oldestDate[0].timestamp}`);
    }

    // 6. Test the actual API endpoint
    console.log('\n🌐 Testing API endpoint...');
    try {
      const response = await fetch('http://localhost:3000/api/events');
      const data = await response.json();
      console.log(`   Status: ${response.status}`);
      console.log(`   Events returned: ${data.data?.length || 0}`);
      console.log(`   Total reported: ${data.total || 0}`);
      
      if (data.error) {
        console.log(`   Error: ${data.error}`);
      }
    } catch (fetchError) {
      console.log('   ❌ Could not fetch from API (is the server running?)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugAPI().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
});