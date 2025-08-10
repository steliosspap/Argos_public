require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCoordinates() {
  console.log('🔍 Testing coordinate data from events_with_coords view...\n');

  try {
    const { data, error } = await supabase
      .from('events_with_coords')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching data:', error);
      return;
    }

    console.log(`📊 Found ${data.length} events\n`);

    data.forEach((event, index) => {
      const lat = typeof event.latitude === 'string' ? parseFloat(event.latitude) : event.latitude;
      const lng = typeof event.longitude === 'string' ? parseFloat(event.longitude) : event.longitude;
      
      console.log(`Event ${index + 1}: ${event.title}`);
      console.log(`  Raw lat/lng: ${event.latitude}, ${event.longitude}`);
      console.log(`  Parsed lat/lng: ${lat}, ${lng}`);
      console.log(`  Valid coordinates: ${!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180}`);
      console.log(`  GeoJSON format: [${lng}, ${lat}]`);
      console.log('');
    });

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testCoordinates();