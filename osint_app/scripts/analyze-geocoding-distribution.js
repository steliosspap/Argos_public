import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeGeocodingDistribution() {
  console.log('=== Geocoding Distribution Analysis ===\n');
  
  // Get all events with basic location info
  const { data: allEvents, error } = await supabase
    .from('events')
    .select('id, title, country, city, region, latitude, longitude, timestamp, channel')
    .order('timestamp', { ascending: false })
    .limit(500);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Categorize events
  const stats = {
    total: allEvents.length,
    withCoords: 0,
    withoutCoords: 0,
    withCity: 0,
    withoutCity: 0,
    byCountry: {},
    byChannel: {},
    coordsByCountry: {},
    recentWithoutCoords: []
  };
  
  allEvents.forEach(event => {
    // Count coordinates
    if (event.latitude && event.longitude) {
      stats.withCoords++;
      
      // Track coords by country
      if (!stats.coordsByCountry[event.country]) {
        stats.coordsByCountry[event.country] = { total: 0, withCoords: 0 };
      }
      stats.coordsByCountry[event.country].withCoords++;
    } else {
      stats.withoutCoords++;
      
      // Track recent events without coords
      if (stats.recentWithoutCoords.length < 10) {
        stats.recentWithoutCoords.push({
          title: event.title,
          country: event.country,
          city: event.city,
          region: event.region,
          channel: event.channel,
          timestamp: event.timestamp
        });
      }
    }
    
    // Count cities
    if (event.city) {
      stats.withCity++;
    } else {
      stats.withoutCity++;
    }
    
    // Count by country
    stats.byCountry[event.country] = (stats.byCountry[event.country] || 0) + 1;
    if (!stats.coordsByCountry[event.country]) {
      stats.coordsByCountry[event.country] = { total: 0, withCoords: 0 };
    }
    stats.coordsByCountry[event.country].total++;
    
    // Count by channel
    stats.byChannel[event.channel] = (stats.byChannel[event.channel] || 0) + 1;
  });
  
  // Display overall statistics
  console.log('=== Overall Statistics ===');
  console.log(`Total events: ${stats.total}`);
  console.log(`With coordinates: ${stats.withCoords} (${((stats.withCoords/stats.total)*100).toFixed(1)}%)`);
  console.log(`Without coordinates: ${stats.withoutCoords} (${((stats.withoutCoords/stats.total)*100).toFixed(1)}%)`);
  console.log(`With city specified: ${stats.withCity} (${((stats.withCity/stats.total)*100).toFixed(1)}%)`);
  console.log(`Without city: ${stats.withoutCity} (${((stats.withoutCity/stats.total)*100).toFixed(1)}%)`);
  
  // Display geocoding success by country
  console.log('\n=== Geocoding Success by Country ===');
  const countryStats = Object.entries(stats.coordsByCountry)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);
    
  countryStats.forEach(([country, data]) => {
    const percentage = ((data.withCoords / data.total) * 100).toFixed(1);
    console.log(`${country}: ${data.withCoords}/${data.total} events geocoded (${percentage}%)`);
  });
  
  // Display events by channel
  console.log('\n=== Events by Channel ===');
  Object.entries(stats.byChannel)
    .sort((a, b) => b[1] - a[1])
    .forEach(([channel, count]) => {
      console.log(`${channel}: ${count} events`);
    });
  
  // Display recent events without coordinates
  console.log('\n=== Recent Events Without Coordinates ===');
  console.log('(These need geocoding improvement)\n');
  
  stats.recentWithoutCoords.forEach(event => {
    console.log(`Title: ${event.title.substring(0, 60)}...`);
    console.log(`Location: ${event.city || 'No city'}, ${event.region || 'No region'}, ${event.country}`);
    console.log(`Channel: ${event.channel}`);
    console.log(`Date: ${new Date(event.timestamp).toLocaleDateString()}`);
    console.log('---');
  });
  
  // Analyze coordinate precision for events that have them
  const { data: coordEvents } = await supabase
    .from('events')
    .select('latitude, longitude, country, city')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
    
  if (coordEvents && coordEvents.length > 0) {
    console.log('\n=== Coordinate Precision Analysis ===');
    
    const coordGroups = {};
    coordEvents.forEach(event => {
      const key = `${event.latitude.toFixed(2)},${event.longitude.toFixed(2)}`;
      if (!coordGroups[key]) {
        coordGroups[key] = { count: 0, countries: new Set(), cities: new Set() };
      }
      coordGroups[key].count++;
      coordGroups[key].countries.add(event.country);
      if (event.city) coordGroups[key].cities.add(event.city);
    });
    
    const clusters = Object.entries(coordGroups)
      .filter(([coord, data]) => data.count > 5)
      .sort((a, b) => b[1].count - a[1].count);
      
    if (clusters.length > 0) {
      console.log('\nCoordinate clusters (likely using country/region centroids):');
      clusters.slice(0, 5).forEach(([coord, data]) => {
        console.log(`\n${coord}: ${data.count} events`);
        console.log(`Countries: ${Array.from(data.countries).join(', ')}`);
        if (data.cities.size > 0) {
          console.log(`Cities mentioned: ${Array.from(data.cities).slice(0, 5).join(', ')}`);
        }
      });
    }
  }
}

analyzeGeocodingDistribution().catch(console.error);