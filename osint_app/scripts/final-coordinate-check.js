import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function finalCoordinateCheck() {
  console.log('=== Final Coordinate Check ===\n');
  
  // Get recent events
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude')
    .order('timestamp', { ascending: false })
    .limit(100);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Categorize events
  const categories = {
    valid: [],
    nullCoords: [],
    zeroCoords: [],
    invalid: []
  };
  
  events.forEach(event => {
    const lng = event.longitude;
    const lat = event.latitude;
    
    if (lng === null || lat === null) {
      categories.nullCoords.push(event);
    } else if (lng === 0 || lat === 0) {
      categories.zeroCoords.push(event);
    } else if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      categories.invalid.push(event);
    } else {
      categories.valid.push(event);
    }
  });
  
  console.log('Event coordinate summary:');
  console.log(`- Valid coordinates: ${categories.valid.length}`);
  console.log(`- Null coordinates: ${categories.nullCoords.length}`);
  console.log(`- Zero coordinates: ${categories.zeroCoords.length}`);
  console.log(`- Invalid coordinates: ${categories.invalid.length}`);
  console.log(`Total: ${events.length}\n`);
  
  // Show valid West African events
  console.log('\nValid West African events:');
  const westAfrican = categories.valid.filter(e => 
    e.longitude >= -25 && e.longitude <= 0 && 
    ['Mali', 'Nigeria', 'Senegal', 'Ghana', 'Burkina Faso', 'Niger', 'Guinea', 'Mauritania'].includes(e.country)
  );
  
  westAfrican.forEach(event => {
    console.log(`- ${event.title}`);
    console.log(`  Country: ${event.country}, Coords: [${event.longitude}, ${event.latitude}]`);
  });
  
  if (westAfrican.length === 0) {
    console.log('No valid West African events found');
  }
  
  // Show events with problematic coordinates
  if (categories.nullCoords.length > 0) {
    console.log('\n\nEvents with NULL coordinates (should be filtered):');
    categories.nullCoords.slice(0, 5).forEach(event => {
      console.log(`- ${event.title}`);
      console.log(`  Country: ${event.country}`);
    });
  }
  
  if (categories.zeroCoords.length > 0) {
    console.log('\n\nEvents with ZERO coordinates (should be filtered):');
    categories.zeroCoords.slice(0, 5).forEach(event => {
      console.log(`- ${event.title}`);
      console.log(`  Country: ${event.country}, Coords: [${event.longitude}, ${event.latitude}]`);
    });
  }
}

finalCoordinateCheck().catch(console.error);