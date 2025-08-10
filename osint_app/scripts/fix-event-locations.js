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

async function fixEventLocations() {
  console.log('🔧 Fixing event locations...\n');

  try {
    // First, let's check the actual structure of the events table
    const { data: tableInfo, error: tableError } = await supabase
      .from('events')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('Error checking table structure:', tableError);
      return;
    }

    console.log('Sample event structure:', Object.keys(tableInfo?.[0] || {}));

    // Check if events have latitude/longitude columns
    const { data: eventsWithLatLng, error: checkError } = await supabase
      .from('events')
      .select('id, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(10);

    if (!checkError && eventsWithLatLng?.length > 0) {
      console.log(`\n📍 Found ${eventsWithLatLng.length} events with lat/lng columns`);
      
      // Update location column from latitude/longitude
      let updated = 0;
      for (const event of eventsWithLatLng) {
        const { error: updateError } = await supabase.rpc('update_event_location', {
          event_id: event.id,
          lat: event.latitude,
          lng: event.longitude
        });

        if (!updateError) {
          updated++;
        } else {
          // If RPC doesn't exist, try raw SQL update
          const { error: rawError } = await supabase
            .from('events')
            .update({ 
              location: `POINT(${event.longitude} ${event.latitude})` 
            })
            .eq('id', event.id);
          
          if (!rawError) updated++;
        }
      }
      console.log(`✅ Updated ${updated} event locations`);
    }

    // Get all events to check their structure
    const { data: allEvents, error: allError } = await supabase
      .from('events')
      .select('id, title, country, region, latitude, longitude, location')
      .limit(100);

    if (!allError && allEvents) {
      console.log(`\n📊 Event location status:`);
      const withLocation = allEvents.filter(e => e.location).length;
      const withLatLng = allEvents.filter(e => e.latitude && e.longitude).length;
      const withoutAny = allEvents.filter(e => !e.location && !e.latitude && !e.longitude).length;
      
      console.log(`  - With location column: ${withLocation}`);
      console.log(`  - With lat/lng columns: ${withLatLng}`);
      console.log(`  - Without any location: ${withoutAny}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixEventLocations().then(() => {
  console.log('\n✅ Location fix complete');
  process.exit(0);
});