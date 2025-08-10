const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addTestCoordinates() {
  console.log('🔧 Adding test coordinates to events...\n');

  // Define coordinates for key locations
  const locationCoords = {
    'gaza': { lat: 31.5018, lng: 34.4668 },
    'kyiv': { lat: 50.4501, lng: 30.5234 },
    'moscow': { lat: 55.7558, lng: 37.6173 },
    'tehran': { lat: 35.6892, lng: 51.3890 },
    'damascus': { lat: 33.5138, lng: 36.2765 },
  };

  try {
    // Get recent events
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, country')
      .is('latitude', null)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    console.log(`Found ${events.length} events without coordinates\n`);

    // Update events based on their content
    for (const event of events) {
      let coords = null;
      
      // Check title for location keywords
      const titleLower = event.title?.toLowerCase() || '';
      
      if (titleLower.includes('gaza') || event.country?.toLowerCase() === 'palestine') {
        coords = locationCoords.gaza;
      } else if (titleLower.includes('kyiv') || titleLower.includes('kiev') || event.country?.toLowerCase() === 'ukraine') {
        coords = locationCoords.kyiv;
      } else if (titleLower.includes('moscow') || event.country?.toLowerCase() === 'russia') {
        coords = locationCoords.moscow;
      } else if (titleLower.includes('tehran') || event.country?.toLowerCase() === 'iran') {
        coords = locationCoords.tehran;
      } else if (titleLower.includes('damascus') || event.country?.toLowerCase() === 'syria') {
        coords = locationCoords.damascus;
      }

      if (coords) {
        console.log(`Updating event ${event.id}: "${event.title?.substring(0, 50)}..." with coords:`, coords);
        
        const { error: updateError } = await supabase
          .from('events')
          .update({ 
            latitude: coords.lat, 
            longitude: coords.lng 
          })
          .eq('id', event.id);

        if (updateError) {
          console.error('Error updating event:', updateError);
        }
      }
    }

    console.log('\n✅ Test coordinates added!');
    console.log('Refresh the intelligence center to see the events on the map.');

  } catch (err) {
    console.error('Script error:', err);
  }
}

// Note: This is just for testing - in production, proper geocoding should be done during ingestion
console.log('⚠️  This script will add test coordinates to events for demo purposes.');
console.log('In production, events should have proper coordinates from geocoding.\n');

addTestCoordinates();