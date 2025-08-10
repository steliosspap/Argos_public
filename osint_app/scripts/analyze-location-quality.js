import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeLocationQuality() {
  console.log('=== Analyzing Location Data Quality ===\n');
  
  // Get events grouped by country
  const countries = ['Ukraine', 'Russia', 'Israel', 'Palestine'];
  
  for (const country of countries) {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, summary, country, latitude, longitude')
      .eq('country', country)
      .not('latitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(10);
      
    if (error) continue;
    
    console.log(`\n=== ${country} Events ===`);
    
    // Check if all events have same coordinates
    const coords = new Set(events.map(e => `${e.longitude},${e.latitude}`));
    console.log(`Unique coordinates: ${coords.size} out of ${events.length} events`);
    
    if (coords.size === 1) {
      console.log(`WARNING: All events have same coordinates: [${events[0].longitude}, ${events[0].latitude}]`);
    }
    
    // Look for city mentions in titles
    const cityMentions = {
      'Ukraine': ['Kyiv', 'Kiev', 'Mariupol', 'Kharkiv', 'Odesa', 'Odessa', 'Lviv', 'Donetsk', 'Luhansk', 'Zaporizhzhia', 'Dnipro'],
      'Russia': ['Moscow', 'St. Petersburg', 'Petersburg', 'Kursk', 'Belgorod', 'Rostov', 'Crimea'],
      'Israel': ['Gaza', 'Tel Aviv', 'Jerusalem', 'Haifa', 'West Bank', 'Rafah', 'Khan Younis'],
      'Palestine': ['Gaza', 'West Bank', 'Ramallah', 'Bethlehem', 'Nablus', 'Hebron']
    };
    
    const cities = cityMentions[country] || [];
    
    console.log('\nCity mentions in titles:');
    events.forEach(event => {
      const mentionedCities = cities.filter(city => 
        event.title.toLowerCase().includes(city.toLowerCase()) ||
        (event.summary && event.summary.toLowerCase().includes(city.toLowerCase()))
      );
      
      if (mentionedCities.length > 0) {
        console.log(`- "${event.title.substring(0, 50)}..."`);
        console.log(`  Cities mentioned: ${mentionedCities.join(', ')}`);
        console.log(`  Current coords: [${event.longitude}, ${event.latitude}]`);
      }
    });
  }
  
  // Check coordinate precision
  console.log('\n\n=== Coordinate Precision Analysis ===');
  
  const { data: allEvents } = await supabase
    .from('events')
    .select('country, latitude, longitude')
    .not('latitude', 'is', null)
    .limit(200);
    
  const countryCoords = {};
  allEvents.forEach(event => {
    if (!countryCoords[event.country]) {
      countryCoords[event.country] = new Set();
    }
    countryCoords[event.country].add(`${event.longitude.toFixed(4)},${event.latitude.toFixed(4)}`);
  });
  
  console.log('\nCountries using single coordinate for all events:');
  Object.entries(countryCoords).forEach(([country, coordSet]) => {
    if (coordSet.size === 1) {
      const coord = Array.from(coordSet)[0];
      console.log(`- ${country}: All events at ${coord}`);
    }
  });
}

analyzeLocationQuality().catch(console.error);