import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeCoordinateMethods() {
  console.log('=== Analyzing Geocoding Methods and Quality ===\n');
  
  // Get events with coordinates
  const { data: eventsWithCoords, error } = await supabase
    .from('events')
    .select('id, title, country, city, region, latitude, longitude, coordinate_method, coordinate_confidence')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(100);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total events with coordinates analyzed: ${eventsWithCoords.length}\n`);
  
  // Analyze coordinate methods
  const methodCounts = {};
  const confidenceByMethod = {};
  const coordPrecision = {};
  
  eventsWithCoords.forEach(event => {
    // Count methods
    const method = event.coordinate_method || 'unknown';
    methodCounts[method] = (methodCounts[method] || 0) + 1;
    
    // Track confidence by method
    if (!confidenceByMethod[method]) {
      confidenceByMethod[method] = [];
    }
    if (event.coordinate_confidence) {
      confidenceByMethod[method].push(event.coordinate_confidence);
    }
    
    // Check coordinate precision (how many decimal places)
    const latDecimals = event.latitude.toString().split('.')[1]?.length || 0;
    const lngDecimals = event.longitude.toString().split('.')[1]?.length || 0;
    const precision = `${latDecimals}/${lngDecimals} decimals`;
    coordPrecision[precision] = (coordPrecision[precision] || 0) + 1;
  });
  
  // Display method distribution
  console.log('=== Geocoding Methods Used ===');
  Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([method, count]) => {
      const percentage = ((count / eventsWithCoords.length) * 100).toFixed(1);
      console.log(`${method}: ${count} events (${percentage}%)`);
      
      // Show average confidence for this method
      if (confidenceByMethod[method] && confidenceByMethod[method].length > 0) {
        const avgConfidence = confidenceByMethod[method].reduce((a, b) => a + b, 0) / confidenceByMethod[method].length;
        console.log(`  Average confidence: ${avgConfidence.toFixed(2)}`);
      }
    });
  
  // Display coordinate precision analysis
  console.log('\n=== Coordinate Precision ===');
  Object.entries(coordPrecision)
    .sort((a, b) => b[1] - a[1])
    .forEach(([precision, count]) => {
      console.log(`${precision}: ${count} events`);
    });
  
  // Check for duplicate coordinates (same exact lat/lng)
  const coordMap = {};
  eventsWithCoords.forEach(event => {
    const key = `${event.latitude},${event.longitude}`;
    if (!coordMap[key]) {
      coordMap[key] = [];
    }
    coordMap[key].push({
      title: event.title,
      country: event.country,
      city: event.city
    });
  });
  
  const duplicateCoords = Object.entries(coordMap)
    .filter(([coord, events]) => events.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (duplicateCoords.length > 0) {
    console.log('\n=== Events Sharing Exact Coordinates ===');
    duplicateCoords.slice(0, 5).forEach(([coord, events]) => {
      console.log(`\nCoordinate ${coord}: ${events.length} events`);
      events.slice(0, 3).forEach(event => {
        console.log(`  - ${event.title.substring(0, 50)}...`);
        console.log(`    Location: ${event.city || 'N/A'}, ${event.country}`);
      });
    });
  }
  
  // Analyze events without city-level precision
  const countryCentroidEvents = eventsWithCoords.filter(event => 
    event.coordinate_method === 'country_centroid' ||
    event.coordinate_confidence < 0.6 ||
    !event.city
  );
  
  console.log(`\n=== Low Precision Geocoding ===`);
  console.log(`Events using country centroids or low confidence: ${countryCentroidEvents.length}`);
  
  if (countryCentroidEvents.length > 0) {
    console.log('\nExamples:');
    countryCentroidEvents.slice(0, 5).forEach(event => {
      console.log(`\n- ${event.title.substring(0, 60)}...`);
      console.log(`  Country: ${event.country}`);
      console.log(`  City: ${event.city || 'None'}`);
      console.log(`  Method: ${event.coordinate_method || 'unknown'}`);
      console.log(`  Confidence: ${event.coordinate_confidence || 'N/A'}`);
    });
  }
}

analyzeCoordinateMethods().catch(console.error);