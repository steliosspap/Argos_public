import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMissingCoordinates() {
  // Count events with coordinates
  const { count: withCoords } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
    
  // Count events without coordinates
  const { count: withoutCoords } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .or('latitude.is.null,longitude.is.null');
    
  // Get total count
  const { count: total } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
    
  console.log('=== Coordinate Coverage ===');
  console.log(`Total events: ${total}`);
  console.log(`With coordinates: ${withCoords} (${((withCoords/total)*100).toFixed(1)}%)`);
  console.log(`Without coordinates: ${withoutCoords} (${((withoutCoords/total)*100).toFixed(1)}%)`);
  
  // Get samples of events without coordinates
  const { data: noCoordEvents } = await supabase
    .from('events')
    .select('title, country, city, region, timestamp')
    .or('latitude.is.null,longitude.is.null')
    .order('timestamp', { ascending: false })
    .limit(10);
    
  if (noCoordEvents && noCoordEvents.length > 0) {
    console.log('\n=== Recent Events Without Coordinates ===');
    noCoordEvents.forEach(event => {
      console.log(`- ${event.title.substring(0, 60)}...`);
      console.log(`  Location: ${event.city || event.region || 'N/A'}, ${event.country}`);
      console.log(`  Date: ${new Date(event.timestamp).toLocaleDateString()}`);
    });
  }
  
  // Analyze coordinate methods
  const { data: coordMethods } = await supabase
    .from('events')
    .select('coordinate_method')
    .not('coordinate_method', 'is', null);
    
  if (coordMethods && coordMethods.length > 0) {
    const methodCounts = {};
    coordMethods.forEach(event => {
      methodCounts[event.coordinate_method] = (methodCounts[event.coordinate_method] || 0) + 1;
    });
    
    console.log('\n=== Geocoding Methods Used ===');
    Object.entries(methodCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([method, count]) => {
        console.log(`${method}: ${count} events`);
      });
  }
}

checkMissingCoordinates().catch(console.error);