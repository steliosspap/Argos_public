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

async function checkEvents() {
  console.log('🔍 Checking events in database...\n');

  try {
    // Count total events
    const { count: totalEvents, error: countError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    console.log(`📊 Total events in database: ${totalEvents}`);

    // Count events with coordinates
    const { data: eventsWithCoords, error: coordsError } = await supabase
      .from('events')
      .select('id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (coordsError) throw coordsError;
    console.log(`📍 Events with coordinates: ${eventsWithCoords?.length || 0}`);

    // Check events_with_coords view
    const { data: viewData, error: viewError } = await supabase
      .from('events_with_coords')
      .select('id')
      .range(0, 10000);

    if (viewError) throw viewError;
    console.log(`👁️  Events in events_with_coords view: ${viewData?.length || 0}`);

    // Get sample of recent events with coordinates
    const { data: sampleEvents, error: sampleError } = await supabase
      .from('events')
      .select('id, title, latitude, longitude, timestamp, severity')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (sampleError) throw sampleError;
    
    console.log('\n📋 Sample of recent events with coordinates:');
    sampleEvents?.forEach(event => {
      console.log(`  - ${event.title || 'Untitled'}`);
      console.log(`    📍 [${event.latitude}, ${event.longitude}]`);
      console.log(`    🕐 ${new Date(event.timestamp).toLocaleString()}`);
      console.log(`    ⚠️  ${event.severity || 'unknown'} severity\n`);
    });

    // Check what the API endpoint would return
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/events`);
    const apiData = await response.json();
    
    console.log(`\n🌐 API /api/events returns: ${apiData.data?.length || 0} events`);
    console.log(`   Total reported: ${apiData.total || 0}`);

    // Check for events without coordinates
    const { count: noCoords, error: noCoordsError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .or('latitude.is.null,longitude.is.null');

    if (!noCoordsError) {
      console.log(`\n❌ Events without coordinates: ${noCoords}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkEvents().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
});