import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkTripoli() {
  console.log('=== Checking Tripoli Events ===\n');
  
  const { data, error } = await supabase
    .from('events')
    .select('id, title, summary, country, city, latitude, longitude, timestamp')
    .or('title.ilike.%tripoli%,summary.ilike.%tripoli%,city.ilike.%tripoli%')
    .order('timestamp', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${data.length} events mentioning Tripoli:\n`);
  
  data.forEach(event => {
    console.log(`ID: ${event.id}`);
    console.log(`Date: ${new Date(event.timestamp).toLocaleDateString()}`);
    console.log(`Title: ${event.title?.substring(0, 80)}...`);
    console.log(`Country: ${event.country}`);
    console.log(`City: ${event.city || 'Not specified'}`);
    console.log(`Coordinates: [${event.latitude}, ${event.longitude}]`);
    
    // Check if coordinates match Libya or Lebanon
    if (event.latitude && event.longitude) {
      const lat = parseFloat(event.latitude);
      const lng = parseFloat(event.longitude);
      
      // Lebanon's Tripoli: ~34.43°N, 35.84°E
      // Libya's Tripoli: ~32.89°N, 13.19°E
      
      if (Math.abs(lat - 34.43) < 0.5 && Math.abs(lng - 35.84) < 0.5) {
        console.log(`✓ Coordinates match Lebanon's Tripoli`);
      } else if (Math.abs(lat - 32.89) < 0.5 && Math.abs(lng - 13.19) < 0.5) {
        console.log(`✗ Coordinates match Libya's Tripoli`);
      } else if (Math.abs(lat - 35.84) < 0.5 && Math.abs(lng - 34.43) < 0.5) {
        console.log(`⚠️  Coordinates appear SWAPPED (lng/lat reversed)`);
      } else {
        console.log(`? Coordinates don't match either Tripoli`);
      }
    }
    console.log('---\n');
  });
  
  // Also check for any events with swapped coordinates
  console.log('\n=== Checking for Swapped Coordinates ===\n');
  
  const { data: swappedData, error: swappedError } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude')
    .or('country.eq.Lebanon,country.eq.Libya')
    .not('latitude', 'is', null)
    .limit(50);
    
  if (!swappedError && swappedData) {
    const swapped = swappedData.filter(event => {
      const lat = parseFloat(event.latitude);
      const lng = parseFloat(event.longitude);
      
      // Check if coordinates are in wrong hemisphere or swapped
      if (event.country === 'Lebanon' && lng < 30) {
        return true; // Lebanon should have longitude > 30
      }
      if (event.country === 'Libya' && lng > 30) {
        return true; // Libya should have longitude < 30
      }
      return false;
    });
    
    if (swapped.length > 0) {
      console.log(`Found ${swapped.length} events with potentially incorrect coordinates:`);
      swapped.forEach(event => {
        console.log(`- ${event.country}: [${event.latitude}, ${event.longitude}] - ${event.title?.substring(0, 50)}...`);
      });
    } else {
      console.log('No obviously swapped coordinates found.');
    }
  }
}

checkTripoli().catch(console.error);