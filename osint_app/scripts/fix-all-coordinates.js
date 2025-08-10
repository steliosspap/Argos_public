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

async function fixAllCoordinates() {
  console.log('🔧 Fixing all coordinate issues...\n');

  try {
    // Country coordinates with CORRECT [longitude, latitude] order
    const COUNTRY_COORDS = {
      'Ukraine': { lat: 48.3794, lng: 31.1656 },
      'Russia': { lat: 61.5240, lng: 105.3188 },
      'Israel': { lat: 31.0461, lng: 34.8516 },
      'Palestine': { lat: 31.9522, lng: 35.2332 },
      'Gaza': { lat: 31.5018, lng: 34.4668 },
      'West Bank': { lat: 31.9038, lng: 35.2742 },
      'Syria': { lat: 34.8021, lng: 38.9968 },
      'Lebanon': { lat: 33.8547, lng: 35.8623 },
      'Iran': { lat: 32.4279, lng: 53.6880 },
      'Iraq': { lat: 33.2232, lng: 43.6793 },
      'Yemen': { lat: 15.5527, lng: 48.5164 },
      'Slovakia': { lat: 48.6690, lng: 19.6990 },
    };

    for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
      // Get events for this country
      const { data: events, error: fetchError } = await supabase
        .from('events')
        .select('id, country, latitude, longitude')
        .eq('country', country)
        .not('latitude', 'is', null);
        
      if (fetchError) {
        console.error(`Error fetching ${country} events:`, fetchError);
        continue;
      }
      
      if (!events || events.length === 0) continue;
      
      let fixed = 0;
      let needsFixing = 0;
      
      for (const event of events) {
        // Check if coordinates are swapped (latitude > 90 or longitude out of bounds)
        const needsSwap = Math.abs(event.longitude) > 90 && Math.abs(event.latitude) <= 180;
        const wrongCoords = (country === 'Ukraine' && event.longitude === 48.3794) ||
                           (country === 'Russia' && event.longitude === 61.524) ||
                           (country === 'Slovakia' && event.longitude === 48.669);
        
        if (needsSwap || wrongCoords) {
          needsFixing++;
          const { error: updateError } = await supabase
            .from('events')
            .update({ 
              latitude: coords.lat, 
              longitude: coords.lng 
            })
            .eq('id', event.id);
            
          if (!updateError) {
            fixed++;
          } else {
            console.error(`Error updating event ${event.id}:`, updateError);
          }
        }
      }
      
      if (needsFixing > 0) {
        console.log(`${country}: Fixed ${fixed}/${needsFixing} events with wrong coordinates`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixAllCoordinates().then(() => {
  console.log('\n✅ Coordinate fix complete');
  process.exit(0);
});