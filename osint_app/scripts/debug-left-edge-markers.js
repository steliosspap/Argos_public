import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugLeftEdgeMarkers() {
  console.log('=== Debugging Left Edge Markers ===\n');
  
  // Check events with coordinates near Western Africa (-20 to 5 longitude)
  const { data: leftEdgeEvents, error } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude, location, timestamp')
    .gte('longitude', -25)
    .lte('longitude', 10)
    .order('timestamp', { ascending: false })
    .limit(50);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${leftEdgeEvents.length} events in longitude range -25 to 10:\n`);
  
  // Group by approximate longitude
  const longitudeGroups = {};
  leftEdgeEvents.forEach(event => {
    const lng = event.longitude;
    const lngGroup = Math.floor(lng / 5) * 5; // Group by 5 degree increments
    if (!longitudeGroups[lngGroup]) {
      longitudeGroups[lngGroup] = [];
    }
    longitudeGroups[lngGroup].push(event);
  });
  
  // Display grouped results
  Object.keys(longitudeGroups).sort((a, b) => Number(a) - Number(b)).forEach(group => {
    console.log(`\nLongitude ${group} to ${Number(group) + 5}:`);
    console.log(`Found ${longitudeGroups[group].length} events`);
    
    longitudeGroups[group].slice(0, 5).forEach(event => {
      console.log(`  - ${event.title}`);
      console.log(`    Country: ${event.country}`);
      console.log(`    Coords: [${event.longitude}, ${event.latitude}]`);
      console.log(`    Location obj: ${JSON.stringify(event.location)}`);
    });
    
    if (longitudeGroups[group].length > 5) {
      console.log(`  ... and ${longitudeGroups[group].length - 5} more`);
    }
  });
  
  // Check for any zero or near-zero coordinates
  console.log('\n=== Checking for Zero/Near-Zero Coordinates ===\n');
  const { data: zeroCoords } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude')
    .or('and(longitude.gte.-1,longitude.lte.1),and(latitude.gte.-1,latitude.lte.1)')
    .limit(20);
    
  if (zeroCoords && zeroCoords.length > 0) {
    console.log(`Found ${zeroCoords.length} events with coordinates near [0,0]:`);
    zeroCoords.forEach(event => {
      console.log(`  - ${event.title}`);
      console.log(`    Country: ${event.country}`);
      console.log(`    Coords: [${event.longitude}, ${event.latitude}]`);
    });
  } else {
    console.log('No events found with coordinates near [0,0]');
  }
  
  // Check events with valid West Africa coordinates
  console.log('\n=== Valid West Africa Events ===\n');
  const westAfricaCountries = ['Mauritania', 'Senegal', 'Mali', 'Burkina Faso', 'Niger', 'Guinea', 'Sierra Leone', 'Liberia', 'Ivory Coast', 'Ghana', 'Togo', 'Benin', 'Nigeria'];
  
  const { data: westAfricaEvents } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude')
    .in('country', westAfricaCountries)
    .order('timestamp', { ascending: false })
    .limit(20);
    
  if (westAfricaEvents && westAfricaEvents.length > 0) {
    console.log(`Found ${westAfricaEvents.length} West Africa events:`);
    westAfricaEvents.forEach(event => {
      console.log(`  - ${event.title}`);
      console.log(`    Country: ${event.country}`);
      console.log(`    Coords: [${event.longitude}, ${event.latitude}]`);
    });
  }
}

debugLeftEdgeMarkers().catch(console.error);