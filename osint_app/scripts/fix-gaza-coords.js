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

async function fixGazaCoordinates() {
  console.log('🔧 Fixing Gaza coordinates...\n');

  try {
    // Get all Gaza events
    const { data: gazaEvents, error: fetchError } = await supabase
      .from('events')
      .select('id, country, latitude, longitude, title')
      .eq('country', 'Gaza')
      .not('latitude', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching Gaza events:', fetchError);
      return;
    }
    
    console.log(`Found ${gazaEvents?.length || 0} Gaza events with coordinates`);
    
    if (!gazaEvents || gazaEvents.length === 0) return;
    
    // Gaza Strip actual coordinates
    const gazaLat = 31.5018;
    const gazaLng = 34.4668;
    
    let fixed = 0;
    let errors = 0;
    
    for (const event of gazaEvents) {
      // Check if coordinates are wrong (longitude should be around 34, not -23)
      if (event.longitude < 0 || event.longitude > 40 || event.latitude < 30 || event.latitude > 33) {
        console.log(`Fixing event ${event.id}: "${event.title?.substring(0, 50)}..."`);
        console.log(`  Old coords: [${event.latitude}, ${event.longitude}]`);
        console.log(`  New coords: [${gazaLat}, ${gazaLng}]`);
        
        const { error: updateError } = await supabase
          .from('events')
          .update({ latitude: gazaLat, longitude: gazaLng })
          .eq('id', event.id);
          
        if (updateError) {
          console.error(`  Error updating: ${updateError.message}`);
          errors++;
        } else {
          fixed++;
        }
      }
    }
    
    console.log(`\n✅ Fixed ${fixed} events`);
    if (errors > 0) {
      console.log(`❌ Failed to fix ${errors} events`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixGazaCoordinates().then(() => {
  console.log('\n✅ Script complete');
  process.exit(0);
});