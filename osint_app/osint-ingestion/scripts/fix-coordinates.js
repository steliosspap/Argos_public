import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixCoordinates() {
  console.log('Fetching events with missing coordinates...');
  
  // Get events that have location but no lat/lng
  const { data: events, error } = await supabase
    .from('events')
    .select('id, location')
    .is('latitude', null)
    .not('location', 'is', null)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${events.length} events to fix`);
  
  // Parse PostGIS geometry and extract coordinates
  for (const event of events) {
    // PostGIS stores as hex, we need to parse it
    // For now, use the database to do the conversion
    const { data, error: updateError } = await supabase
      .rpc('get_coordinates_from_geography', { 
        geog: event.location 
      });
      
    if (!updateError && data) {
      const { lat, lng } = data;
      
      const { error: patchError } = await supabase
        .from('events')
        .update({ 
          latitude: lat,
          longitude: lng 
        })
        .eq('id', event.id);
        
      if (patchError) {
        console.error(`Error updating event ${event.id}:`, patchError);
      } else {
        console.log(`Fixed event ${event.id}: lat=${lat}, lng=${lng}`);
      }
    }
  }
  
  console.log('Coordinate fix complete!');
}

// First, let's create the helper function if it doesn't exist
async function createHelperFunction() {
  const { error } = await supabase.rpc('execute_sql', {
    query: `
      CREATE OR REPLACE FUNCTION get_coordinates_from_geography(geog geography)
      RETURNS TABLE(lat double precision, lng double precision) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          ST_Y(geog::geometry) as lat,
          ST_X(geog::geometry) as lng;
      END;
      $$ LANGUAGE plpgsql;
    `
  });
  
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating function:', error);
  }
}

// Run the fix
createHelperFunction()
  .then(() => fixCoordinates())
  .catch(console.error);