import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEventDistribution() {
  console.log('=== Checking Event Geographic Distribution ===\n');
  
  // Get unique events (deduplicated by title)
  const { data: allEvents, error } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude, timestamp')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(500);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Deduplicate by title
  const uniqueEvents = [];
  const seenTitles = new Set();
  
  allEvents.forEach(event => {
    if (!seenTitles.has(event.title)) {
      seenTitles.add(event.title);
      uniqueEvents.push(event);
    }
  });
  
  console.log(`Total unique events with coordinates: ${uniqueEvents.length}\n`);
  
  // Group by regions
  const regions = {
    'West Africa': { bounds: { minLng: -25, maxLng: 20, minLat: 0, maxLat: 25 }, events: [] },
    'Middle East': { bounds: { minLng: 20, maxLng: 60, minLat: 10, maxLat: 45 }, events: [] },
    'Europe': { bounds: { minLng: -15, maxLng: 50, minLat: 35, maxLat: 70 }, events: [] },
    'Asia': { bounds: { minLng: 60, maxLng: 150, minLat: -10, maxLat: 60 }, events: [] },
    'Americas': { bounds: { minLng: -170, maxLng: -30, minLat: -60, maxLat: 70 }, events: [] },
    'Other': { bounds: null, events: [] }
  };
  
  // Categorize events
  uniqueEvents.forEach(event => {
    let categorized = false;
    for (const [region, data] of Object.entries(regions)) {
      if (region === 'Other') continue;
      const { bounds } = data;
      if (event.longitude >= bounds.minLng && event.longitude <= bounds.maxLng &&
          event.latitude >= bounds.minLat && event.latitude <= bounds.maxLat) {
        data.events.push(event);
        categorized = true;
        break;
      }
    }
    if (!categorized) {
      regions.Other.events.push(event);
    }
  });
  
  // Display distribution
  console.log('Geographic Distribution:');
  Object.entries(regions).forEach(([region, data]) => {
    if (data.events.length > 0) {
      console.log(`\n${region}: ${data.events.length} events`);
      
      // Show country distribution
      const countries = {};
      data.events.forEach(event => {
        countries[event.country] = (countries[event.country] || 0) + 1;
      });
      
      Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([country, count]) => {
          console.log(`  - ${country}: ${count} events`);
        });
    }
  });
  
  // Check for clustering
  console.log('\n\n=== Checking for Geographic Clustering ===');
  
  // Find events clustered at same coordinates
  const coordClusters = {};
  uniqueEvents.forEach(event => {
    const key = `${event.longitude.toFixed(4)},${event.latitude.toFixed(4)}`;
    if (!coordClusters[key]) {
      coordClusters[key] = [];
    }
    coordClusters[key].push(event);
  });
  
  const clustered = Object.entries(coordClusters)
    .filter(([coord, events]) => events.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
    
  if (clustered.length > 0) {
    console.log(`\nFound ${clustered.length} coordinate clusters:`);
    clustered.slice(0, 5).forEach(([coord, events]) => {
      const [lng, lat] = coord.split(',').map(Number);
      console.log(`\nCoordinate [${lng}, ${lat}]: ${events.length} events`);
      events.slice(0, 3).forEach(event => {
        console.log(`  - ${event.title.substring(0, 60)}...`);
        console.log(`    Country: ${event.country}`);
      });
    });
  }
  
  // List all unique countries with events
  console.log('\n\n=== Countries with Events ===');
  const countryCount = {};
  uniqueEvents.forEach(event => {
    countryCount[event.country] = (countryCount[event.country] || 0) + 1;
  });
  
  Object.entries(countryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([country, count]) => {
      console.log(`${country}: ${count} events`);
    });
}

checkEventDistribution().catch(console.error);