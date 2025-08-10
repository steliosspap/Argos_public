import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { enhancedFixCoordinates, extractCityFromText } from './enhanced-coordinate-fixer.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Need service role key for updates
);

async function fixEventCoordinates() {
  console.log('=== Fixing Event Coordinates ===\n');
  
  // Get all events with coordinates
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, summary, country, latitude, longitude')
    .not('latitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(1000);
    
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${events.length} events to process\n`);
  
  // Group events by country to check for country-centroid usage
  const countryGroups = {};
  events.forEach(event => {
    if (!countryGroups[event.country]) {
      countryGroups[event.country] = [];
    }
    countryGroups[event.country].push(event);
  });
  
  // Process each country's events
  let totalUpdated = 0;
  let cityExtractions = {};
  
  for (const [country, countryEvents] of Object.entries(countryGroups)) {
    console.log(`\nProcessing ${countryEvents.length} events from ${country}`);
    
    // Check if all events have same coordinates (country centroid)
    const coords = new Set(countryEvents.map(e => `${e.longitude},${e.latitude}`));
    const usingCentroid = coords.size === 1;
    
    if (usingCentroid) {
      console.log(`WARNING: All ${country} events use same coordinates: ${Array.from(coords)[0]}`);
    }
    
    // Process each event
    for (const event of countryEvents) {
      const extractedCity = extractCityFromText(event.title, event.summary, event.country);
      
      if (extractedCity) {
        if (!cityExtractions[extractedCity]) {
          cityExtractions[extractedCity] = 0;
        }
        cityExtractions[extractedCity]++;
        
        const fix = enhancedFixCoordinates(event);
        
        if (fix && (fix.longitude !== event.longitude || fix.latitude !== event.latitude)) {
          console.log(`  Updating: "${event.title.substring(0, 50)}..."`);
          console.log(`    City: ${extractedCity}`);
          console.log(`    Old coords: [${event.longitude}, ${event.latitude}]`);
          console.log(`    New coords: [${fix.longitude}, ${fix.latitude}]`);
          
          // Update the event
          const { error: updateError } = await supabase
            .from('events')
            .update({
              latitude: fix.latitude,
              longitude: fix.longitude,
              location: `POINT(${fix.longitude} ${fix.latitude})`
            })
            .eq('id', event.id);
            
          if (updateError) {
            console.error(`    ERROR updating: ${updateError.message}`);
          } else {
            totalUpdated++;
          }
        }
      }
    }
  }
  
  // Summary
  console.log('\n\n=== Summary ===');
  console.log(`Total events processed: ${events.length}`);
  console.log(`Events updated: ${totalUpdated}`);
  console.log('\nCity extractions:');
  Object.entries(cityExtractions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count} events`);
    });
}

// Check if we have service role key
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required to update database');
  console.log('\nTo fix coordinates, you need to:');
  console.log('1. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
  console.log('2. Run this script again');
  console.log('\nAlternatively, you can implement the coordinate fixing in your ingestion pipeline.');
} else {
  fixEventCoordinates().catch(console.error);
}