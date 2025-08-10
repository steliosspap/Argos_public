#!/usr/bin/env node

/**
 * Script to geocode existing events that have no coordinates
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
// Known conflict zone coordinates for better accuracy
const KNOWN_LOCATIONS = {
  // Countries
  'Ukraine': [31.1656, 48.3794],
  'Russia': [105.3188, 61.5240],
  'Israel': [34.8516, 31.0461],
  'Palestine': [35.2332, 31.9522],
  'Gaza': [34.4668, 31.5018],
  'Gaza Strip': [34.4668, 31.5018],
  'West Bank': [35.2, 31.9],
  'Lebanon': [35.8623, 33.8547],
  'Syria': [38.9968, 34.8021],
  'Iraq': [43.6793, 33.2232],
  'Yemen': [48.5164, 15.5527],
  'Sudan': [30.2176, 12.8628],
  'South Sudan': [31.3070, 6.8770],
  'Myanmar': [95.9560, 21.9139],
  'Somalia': [46.1996, 5.1521],
  'Mali': [-3.9962, 17.5707],
  'Burkina Faso': [-1.5616, 12.2383],
  'Nigeria': [8.6753, 9.0820],
  'Niger': [8.0817, 17.6078],
  'Ethiopia': [40.4897, 9.1450],
  'Afghanistan': [67.7100, 33.9391],
  'Pakistan': [69.3451, 30.3753],
  'Libya': [17.2283, 26.3351],
  'Egypt': [30.8025, 26.8206],
  'Iran': [53.6880, 32.4279],
  'Turkey': [35.2433, 38.9637],
  'India': [78.9629, 20.5937],
  'China': [104.1954, 35.8617],
  'Bangladesh': [90.3563, 23.6850],
  'France': [2.2137, 46.2276],
  'United Kingdom': [-3.4360, 55.3781],
  'UK': [-3.4360, 55.3781],
  'United States': [-95.7129, 37.0902],
  'USA': [-95.7129, 37.0902],
  'Australia': [133.7751, -25.2744],
  'Norway': [8.4689, 60.4720],
  'Netherlands': [5.2913, 52.1326],
  'Slovakia': [19.6990, 48.6690],
  
  // Major cities in conflict zones
  'Kyiv': [30.5234, 50.4501],
  'Kiev': [30.5234, 50.4501],
  'Moscow': [37.6173, 55.7558],
  'Jerusalem': [35.2137, 31.7683],
  'Tel Aviv': [34.7818, 32.0853],
  'Gaza City': [34.4668, 31.5018],
  'Damascus': [36.2765, 33.5138],
  'Baghdad': [44.3661, 33.3152],
  'Beirut': [35.5018, 33.8938],
  'Kabul': [69.2075, 34.5553],
  'Khartoum': [32.5599, 15.5007],
  'Juba': [31.5825, 4.8594],
  'Yangon': [96.1561, 16.8661],
  'Mogadishu': [45.3182, 2.0469],
  'Tripoli': [13.1913, 32.8872],
  'Cairo': [31.2357, 30.0444],
  'Tehran': [51.3890, 35.6892],
  'Ankara': [32.8597, 39.9334],
  'Istanbul': [28.9784, 41.0082],
  
  // Regions
  'Donbas': [37.8, 48.0],
  'Crimea': [34.0, 45.0],
  'Kashmir': [75.3, 34.0],
  'Tigray': [38.5, 13.5],
  'Darfur': [24.0, 13.0],
  'Sinai': [33.8, 29.5],
  'Golan Heights': [35.7, 33.0],
  
  // Handle special cases
  'Israel/Gaza': [34.8516, 31.0461] // Default to Israel coords
};

function getCoordinatesForLocation(country, city, region) {
  // Try city first (most specific)
  if (city && KNOWN_LOCATIONS[city]) {
    return KNOWN_LOCATIONS[city];
  }
  
  // Try region
  if (region && KNOWN_LOCATIONS[region]) {
    return KNOWN_LOCATIONS[region];
  }
  
  // Try country (least specific)
  if (country) {
    // Try exact match first
    if (KNOWN_LOCATIONS[country]) {
      return KNOWN_LOCATIONS[country];
    }
    
    // Try case-insensitive match
    const normalizedCountry = country.toLowerCase().trim();
    for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
      if (key.toLowerCase() === normalizedCountry) {
        return coords;
      }
    }
    
    // Handle special cases
    if (normalizedCountry === 'united states' || normalizedCountry === 'united states of america') {
      return KNOWN_LOCATIONS['USA'];
    }
    if (normalizedCountry === 'united kingdom') {
      return KNOWN_LOCATIONS['UK'];
    }
  }
  
  return null;
}

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function geocodeExistingEvents() {
  console.log('🗺️  Geocoding existing events without coordinates...\n');
  
  // Get events without coordinates from the last 7 days (reduced from 60 to avoid timeout)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: eventsWithoutCoords, error } = await supabase
    .from('events')
    .select('id, country, city, region, title')
    .or('latitude.is.null,longitude.is.null')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${eventsWithoutCoords.length} events without coordinates\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (const event of eventsWithoutCoords) {
    const coords = getCoordinatesForLocation(event.country, event.city, event.region);
    
    if (coords) {
      const { error: updateError } = await supabase
        .from('events')
        .update({
          latitude: coords[1],
          longitude: coords[0]
        })
        .eq('id', event.id);
        
      if (updateError) {
        console.error(`❌ Failed to update event ${event.id}:`, updateError);
        failed++;
      } else {
        console.log(`✅ Updated: ${event.title?.substring(0, 50)}...`);
        console.log(`   Location: ${event.country}, ${event.city || event.region || 'N/A'} → [${coords[1]}, ${coords[0]}]`);
        updated++;
      }
    } else {
      console.log(`⚠️  No coordinates found for: ${event.title?.substring(0, 50)}...`);
      console.log(`   Location: ${event.country}, ${event.city || event.region || 'N/A'}`);
      failed++;
    }
  }
  
  console.log(`\n📊 RESULTS:`);
  console.log(`✅ Successfully geocoded: ${updated} events`);
  console.log(`❌ Failed to geocode: ${failed} events`);
  console.log(`\nEvents should now appear on the map!`);
}

geocodeExistingEvents().catch(console.error);