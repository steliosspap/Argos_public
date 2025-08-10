import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function diagnoseLeftEdge() {
  console.log('=== Diagnosing Left Edge Markers ===\n');
  
  // Get all events
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude, location')
    .order('timestamp', { ascending: false })
    .limit(200);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Filter for events that would appear on the left edge
  const leftEdgeEvents = events.filter(event => {
    const lng = event.longitude;
    const lat = event.latitude;
    
    // Check for various problematic patterns
    if (lng === null || lat === null) return false;
    
    // Left edge of map (Western Africa region)
    if (lng >= -25 && lng <= -10) return true;
    
    // Near zero coordinates
    if (Math.abs(lng) < 1 && Math.abs(lat) < 1) return true;
    
    // Exact zeros
    if (lng === 0 || lat === 0) return true;
    
    // Edge coordinates
    if (Math.abs(lng) === 180 || Math.abs(lat) === 90) return true;
    
    return false;
  });
  
  console.log(`Found ${leftEdgeEvents.length} events that might appear on left edge:\n`);
  
  // Group by coordinate pattern
  const patterns = {
    'Western Africa (-25 to -10 lng)': [],
    'Near Zero (<1 degree)': [],
    'Exact Zero': [],
    'Map Edge': [],
    'Other': []
  };
  
  leftEdgeEvents.forEach(event => {
    const lng = event.longitude;
    const lat = event.latitude;
    
    if (lng === 0 || lat === 0) {
      patterns['Exact Zero'].push(event);
    } else if (Math.abs(lng) < 1 && Math.abs(lat) < 1) {
      patterns['Near Zero (<1 degree)'].push(event);
    } else if (Math.abs(lng) === 180 || Math.abs(lat) === 90) {
      patterns['Map Edge'].push(event);
    } else if (lng >= -25 && lng <= -10) {
      patterns['Western Africa (-25 to -10 lng)'].push(event);
    } else {
      patterns['Other'].push(event);
    }
  });
  
  // Display results
  Object.entries(patterns).forEach(([pattern, events]) => {
    if (events.length > 0) {
      console.log(`\n${pattern}: ${events.length} events`);
      events.slice(0, 5).forEach(event => {
        console.log(`  - ${event.title}`);
        console.log(`    Country: ${event.country}`);
        console.log(`    Coords: [${event.longitude}, ${event.latitude}]`);
        console.log(`    Location obj: ${JSON.stringify(event.location)}`);
      });
      if (events.length > 5) {
        console.log(`  ... and ${events.length - 5} more`);
      }
    }
  });
  
  // Check for specific problematic coordinates
  console.log('\n\n=== Checking for Invalid Coordinate Patterns ===');
  
  const invalidPatterns = events.filter(event => {
    const lng = event.longitude;
    const lat = event.latitude;
    
    return (
      // Null island
      (lng === 0 && lat === 0) ||
      // Single zero
      lng === 0 || lat === 0 ||
      // Invalid ranges
      lng < -180 || lng > 180 || lat < -90 || lat > 90 ||
      // NaN or null
      isNaN(lng) || isNaN(lat) || lng === null || lat === null
    );
  });
  
  console.log(`\nFound ${invalidPatterns.length} events with invalid coordinates`);
  if (invalidPatterns.length > 0) {
    console.log('First 10 invalid events:');
    invalidPatterns.slice(0, 10).forEach(event => {
      console.log(`  - ${event.title}`);
      console.log(`    Coords: [${event.longitude}, ${event.latitude}]`);
    });
  }
}

diagnoseLeftEdge().catch(console.error);