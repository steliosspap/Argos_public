import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDuplicates() {
  console.log('=== Checking for Duplicate Events ===\n');
  
  // Get all events
  const { data: allEvents, error } = await supabase
    .from('events')
    .select('id, title, country, latitude, longitude, timestamp')
    .order('timestamp', { ascending: false })
    .limit(500);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  // Group by title to find duplicates
  const titleGroups = {};
  allEvents.forEach(event => {
    const key = event.title;
    if (!titleGroups[key]) {
      titleGroups[key] = [];
    }
    titleGroups[key].push(event);
  });
  
  // Find titles with duplicates
  const duplicates = Object.entries(titleGroups)
    .filter(([title, events]) => events.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`Found ${duplicates.length} duplicate event titles:\n`);
  
  duplicates.slice(0, 10).forEach(([title, events]) => {
    console.log(`Title: "${title}"`);
    console.log(`Count: ${events.length} duplicates`);
    console.log(`Countries: ${[...new Set(events.map(e => e.country))].join(', ')}`);
    console.log(`Coordinates: ${[...new Set(events.map(e => `[${e.longitude}, ${e.latitude}]`))].join(', ')}`);
    console.log(`IDs: ${events.map(e => e.id).join(', ')}`);
    console.log('---\n');
  });
  
  // Summary statistics
  const totalDuplicateEvents = duplicates.reduce((sum, [title, events]) => sum + events.length, 0);
  const totalUniqueEvents = Object.keys(titleGroups).length;
  
  console.log('\n=== Summary ===');
  console.log(`Total events checked: ${allEvents.length}`);
  console.log(`Unique events: ${totalUniqueEvents}`);
  console.log(`Duplicate events: ${totalDuplicateEvents}`);
  console.log(`Duplication rate: ${((totalDuplicateEvents / allEvents.length) * 100).toFixed(1)}%`);
}

checkDuplicates().catch(console.error);