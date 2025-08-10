// Script to check if events are being updated in the database
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEventUpdates() {
  console.log('Checking event updates...\n');
  
  try {
    // Get total count
    const { count: totalCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total events in database: ${totalCount}`);
    
    // Get latest events
    const { data: latestEvents, error } = await supabase
      .from('events')
      .select('id, title, timestamp, created_at, updated_at')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    console.log('\nLatest 10 events:');
    console.log('==================');
    
    latestEvents.forEach(event => {
      const age = new Date() - new Date(event.timestamp);
      const ageMinutes = Math.floor(age / 60000);
      const ageHours = Math.floor(ageMinutes / 60);
      const ageDisplay = ageHours > 0 ? `${ageHours}h ${ageMinutes % 60}m` : `${ageMinutes}m`;
      
      console.log(`\n${event.title.substring(0, 80)}...`);
      console.log(`  ID: ${event.id}`);
      console.log(`  Timestamp: ${new Date(event.timestamp).toLocaleString()} (${ageDisplay} ago)`);
      console.log(`  Created: ${new Date(event.created_at).toLocaleString()}`);
      if (event.updated_at) {
        console.log(`  Updated: ${new Date(event.updated_at).toLocaleString()}`);
      }
    });
    
    // Check events from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', oneHourAgo);
    
    console.log(`\nEvents from last hour: ${recentCount}`);
    
    // Check events from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', oneDayAgo);
    
    console.log(`Events from last 24 hours: ${dailyCount}`);
    
    // Monitor for 30 seconds
    console.log('\nMonitoring for new events for 30 seconds...');
    let lastCount = totalCount;
    
    const interval = setInterval(async () => {
      const { count: currentCount } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true });
      
      if (currentCount > lastCount) {
        console.log(`✅ NEW EVENTS DETECTED! Count increased from ${lastCount} to ${currentCount}`);
        lastCount = currentCount;
      } else {
        process.stdout.write('.');
      }
    }, 5000);
    
    setTimeout(() => {
      clearInterval(interval);
      console.log('\n\nMonitoring complete.');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkEventUpdates();