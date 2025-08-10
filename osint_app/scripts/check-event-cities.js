import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEventCities() {
  console.log('=== Checking Event Location Details ===\n');
  
  // Get sample events with coordinates
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, summary, country, city, region, latitude, longitude')
    .not('latitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(30);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Check for city information in events
  let eventsWithCity = 0;
  let eventsWithRegion = 0;
  let eventsWithCityInTitle = 0;
  
  console.log('Sample events with location details:\n');
  
  events.forEach(event => {
    if (event.city) eventsWithCity++;
    if (event.region) eventsWithRegion++;
    
    // Check if city is mentioned in title
    const cities = ['Kyiv', 'Kiev', 'Mariupol', 'Kharkiv', 'Gaza', 'Tel Aviv', 'Moscow', 'Damascus', 'Tehran', 'Beijing', 'Mumbai', 'Delhi'];
    const cityInTitle = cities.find(city => event.title.toLowerCase().includes(city.toLowerCase()));
    if (cityInTitle) eventsWithCityInTitle++;
    
    console.log(`Event: ${event.title.substring(0, 60)}...`);
    console.log(`  Country: ${event.country}`);
    console.log(`  City: ${event.city || 'N/A'}`);
    console.log(`  Region: ${event.region || 'N/A'}`);
    console.log(`  Coords: [${event.longitude}, ${event.latitude}]`);
    if (cityInTitle) {
      console.log(`  City in title: ${cityInTitle}`);
    }
    console.log('');
  });
  
  console.log('\n=== Summary ===');
  console.log(`Total events checked: ${events.length}`);
  console.log(`Events with city field: ${eventsWithCity}`);
  console.log(`Events with region field: ${eventsWithRegion}`);
  console.log(`Events with city in title: ${eventsWithCityInTitle}`);
  
  // Check for location extraction from summary
  console.log('\n=== Checking Summary for Location Info ===\n');
  
  const locationKeywords = ['in', 'at', 'near', 'outside', 'north of', 'south of', 'east of', 'west of'];
  
  events.slice(0, 10).forEach(event => {
    console.log(`\nEvent: ${event.title.substring(0, 50)}...`);
    if (event.summary) {
      // Look for location patterns in summary
      const summaryLower = event.summary.toLowerCase();
      locationKeywords.forEach(keyword => {
        const index = summaryLower.indexOf(keyword + ' ');
        if (index !== -1) {
          const afterKeyword = event.summary.substring(index + keyword.length + 1);
          const nextWords = afterKeyword.split(/[,.\s]/).slice(0, 3).join(' ');
          console.log(`  Found "${keyword}": ${nextWords}`);
        }
      });
    }
  });
}

checkEventCities().catch(console.error);