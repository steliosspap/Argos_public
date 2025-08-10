const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testEvents() {
  console.log('🔍 Testing event data in Supabase...\n');

  try {
    // Get recent events
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, country, region, timestamp, latitude, longitude, location, escalation_score')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    console.log(`Total events fetched: ${events.length}\n`);

    // Group by country
    const byCountry = {};
    const withCoords = [];
    const withoutCoords = [];

    events.forEach(event => {
      const country = event.country || 'Unknown';
      byCountry[country] = (byCountry[country] || 0) + 1;

      // Check if event has valid coordinates
      if ((event.latitude && event.longitude && event.latitude !== 0 && event.longitude !== 0) ||
          (event.location && event.location.coordinates)) {
        withCoords.push(event);
      } else {
        withoutCoords.push(event);
      }
    });

    console.log('📊 Events by Country:');
    Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([country, count]) => {
        console.log(`  ${country}: ${count} events`);
      });

    console.log(`\n📍 Coordinate Status:`);
    console.log(`  With coordinates: ${withCoords.length}`);
    console.log(`  Without coordinates: ${withoutCoords.length}`);

    // Check for specific conflicts
    console.log('\n🎯 Specific Conflict Zones:');
    const conflicts = ['Gaza', 'Ukraine', 'Israel', 'Palestine', 'Russia', 'Syria'];
    conflicts.forEach(conflict => {
      const matching = events.filter(e => 
        e.country?.includes(conflict) || 
        e.title?.includes(conflict) ||
        e.region?.includes(conflict)
      );
      if (matching.length > 0) {
        console.log(`  ${conflict}: ${matching.length} events`);
        // Show first event as sample
        const sample = matching[0];
        console.log(`    Sample: "${sample.title?.substring(0, 60)}..."`);
        console.log(`    Coords: lat=${sample.latitude}, lng=${sample.longitude}, location=${JSON.stringify(sample.location)}`);
      }
    });

    // Show some events without coordinates
    if (withoutCoords.length > 0) {
      console.log('\n⚠️  Sample events WITHOUT coordinates:');
      withoutCoords.slice(0, 3).forEach(event => {
        console.log(`  - "${event.title?.substring(0, 60)}..." (${event.country})`);
      });
    }

  } catch (err) {
    console.error('Script error:', err);
  }
}

testEvents();