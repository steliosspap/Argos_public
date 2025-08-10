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

// Known country/region coordinates
const LOCATION_COORDINATES = {
  // Countries
  'Ukraine': [48.3794, 31.1656],
  'Russia': [61.5240, 105.3188],
  'Israel': [31.0461, 34.8516],
  'Palestine': [31.9522, 35.2332],
  'Gaza': [31.5018, 34.4668],
  'Lebanon': [33.8547, 35.8623],
  'Syria': [34.8021, 38.9968],
  'Iran': [32.4279, 53.6880],
  'Iraq': [33.2232, 43.6793],
  'Yemen': [15.5527, 48.5164],
  'United States': [37.0902, -95.7129],
  'USA': [37.0902, -95.7129],
  'China': [35.8617, 104.1954],
  'Taiwan': [23.6978, 120.9605],
  'North Korea': [40.3399, 127.5101],
  'South Korea': [35.9078, 127.7669],
  'Japan': [36.2048, 138.2529],
  'India': [20.5937, 78.9629],
  'Pakistan': [30.3753, 69.3451],
  'Afghanistan': [33.9391, 67.7100],
  'Turkey': [38.9637, 35.2433],
  'Saudi Arabia': [23.8859, 45.0792],
  'Egypt': [26.8206, 30.8025],
  'Libya': [26.3351, 17.2283],
  'Sudan': [12.8628, 30.2176],
  'Ethiopia': [9.1450, 40.4897],
  'Somalia': [5.1521, 46.1996],
  'Nigeria': [9.0820, 8.6753],
  'Poland': [51.9194, 19.1451],
  'Germany': [51.1657, 10.4515],
  'France': [46.2276, 2.2137],
  'United Kingdom': [55.3781, -3.4360],
  'UK': [55.3781, -3.4360],
  'Spain': [40.4637, -3.7492],
  'Italy': [41.8719, 12.5674],
  
  // Cities/Regions
  'Kyiv': [50.4501, 30.5234],
  'Kiev': [50.4501, 30.5234],
  'Moscow': [55.7558, 37.6173],
  'Jerusalem': [31.7683, 35.2137],
  'Tel Aviv': [32.0853, 34.7818],
  'Gaza City': [31.5018, 34.4668],
  'Beirut': [33.8938, 35.5018],
  'Damascus': [33.5138, 36.2765],
  'Tehran': [35.6892, 51.3890],
  'Baghdad': [33.3128, 44.3615],
  'Kabul': [34.5553, 69.2075],
  'Islamabad': [33.6844, 73.0479],
  'New Delhi': [28.6139, 77.2090],
  'Beijing': [39.9042, 116.4074],
  'Seoul': [37.5665, 126.9780],
  'Tokyo': [35.6762, 139.6503],
  'Washington': [38.9072, -77.0369],
  'New York': [40.7128, -74.0060],
  'London': [51.5074, -0.1278],
  'Paris': [48.8566, 2.3522],
  'Berlin': [52.5200, 13.4050],
  'Warsaw': [52.2297, 21.0122],
  'Donbas': [48.3000, 37.8000],
  'Donetsk': [48.0159, 37.8028],
  'Luhansk': [48.5740, 39.3078],
  'Crimea': [44.9521, 34.1024],
  'West Bank': [32.0000, 35.3333],
  'Rafah': [31.2979, 34.2446],
  'Khan Younis': [31.3462, 34.3027],
  'Tripoli': [32.8872, 13.1913],
  'Aleppo': [36.2021, 37.1343],
  'Homs': [34.7324, 36.7137],
  'Red Sea': [20.2802, 38.5126],
  'Persian Gulf': [26.9349, 51.5769],
  'Mediterranean': [35.0000, 18.0000],
  'Black Sea': [43.4127, 34.7612],
  'Baltic Sea': [58.0000, 20.0000],
  'Texas': [31.0000, -100.0000],
  'California': [36.7783, -119.4179],
  'Florida': [27.6648, -81.5158],
  'Eastern Europe': [50.0000, 30.0000],
  'Middle East': [29.2985, 42.5510],
  'Central Asia': [43.0000, 65.0000],
  'Southeast Asia': [3.0000, 108.0000],
  'North Africa': [24.0000, 10.0000],
  'Sub-Saharan Africa': [-8.0000, 23.0000],
  'Latin America': [-15.0000, -60.0000],
  'Europe': [54.5260, 15.2551],
  'Asia': [34.0479, 100.6197],
  'Africa': [-8.7832, 34.5085],
  'North America': [54.5260, -105.2551],
  'South America': [-8.7832, -55.4915],
  'Oceania': [-22.7359, 140.0188]
};

// Function to extract location from text
function extractLocation(event) {
  const searchText = `${event.title || ''} ${event.summary || ''} ${event.country || ''} ${event.region || ''}`.toLowerCase();
  
  // Try to find a matching location
  for (const [location, coords] of Object.entries(LOCATION_COORDINATES)) {
    if (searchText.includes(location.toLowerCase())) {
      return { location, coords };
    }
  }
  
  // If no specific location found, try country field
  if (event.country) {
    const countryCoords = LOCATION_COORDINATES[event.country];
    if (countryCoords) {
      return { location: event.country, coords: countryCoords };
    }
  }
  
  // Try region as last resort
  if (event.region) {
    const regionCoords = LOCATION_COORDINATES[event.region];
    if (regionCoords) {
      return { location: event.region, coords: regionCoords };
    }
  }
  
  return null;
}

async function geocodeEvents() {
  console.log('🌍 Starting geocoding process...\n');

  try {
    // Get events without coordinates
    const { data: eventsWithoutCoords, error } = await supabase
      .from('events')
      .select('*')
      .or('latitude.is.null,longitude.is.null')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    console.log(`📍 Found ${eventsWithoutCoords?.length || 0} events without coordinates\n`);

    if (!eventsWithoutCoords || eventsWithoutCoords.length === 0) {
      console.log('✅ All events already have coordinates!');
      return;
    }

    let updated = 0;
    let failed = 0;
    const updates = [];

    for (const event of eventsWithoutCoords) {
      const locationData = extractLocation(event);
      
      if (locationData) {
        const [lat, lng] = locationData.coords;
        updates.push({
          id: event.id,
          latitude: lat,
          longitude: lng
        });
        
        console.log(`✓ ${event.title || 'Untitled event'}`);
        console.log(`  → ${locationData.location} [${lat}, ${lng}]`);
        updated++;
      } else {
        console.log(`✗ ${event.title || 'Untitled event'} - No location found`);
        failed++;
      }
    }

    // Batch update events with coordinates
    if (updates.length > 0) {
      console.log(`\n📤 Updating ${updates.length} events in database...`);
      
      // Update in batches of 100
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        for (const update of batch) {
          const { error: updateError } = await supabase
            .from('events')
            .update({ 
              latitude: update.latitude, 
              longitude: update.longitude 
            })
            .eq('id', update.id);

          if (updateError) {
            console.error(`Error updating event ${update.id}:`, updateError);
          }
        }
        
        console.log(`  Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✓ Geocoded: ${updated} events`);
    console.log(`  ✗ Failed: ${failed} events`);
    console.log(`  📍 Success rate: ${((updated / eventsWithoutCoords.length) * 100).toFixed(1)}%`);

    // Check final count
    const { count: remainingWithoutCoords } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .or('latitude.is.null,longitude.is.null');

    console.log(`\n📍 Remaining events without coordinates: ${remainingWithoutCoords}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

geocodeEvents().then(() => {
  console.log('\n✅ Geocoding complete');
  process.exit(0);
});