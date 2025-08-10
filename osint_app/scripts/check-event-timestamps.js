#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEventTimestamps() {
  console.log('🕐 Checking event timestamps...\n');

  try {
    // Get recent events to check their timestamps
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    console.log('Current date:', now.toISOString());
    console.log('30 days ago:', thirtyDaysAgo.toISOString());
    
    const { data: recentEvents } = await supabase
      .from('events')
      .select('country, timestamp, latitude, longitude')
      .in('country', ['Israel', 'Palestine', 'Gaza', 'Ukraine'])
      .not('latitude', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(20);
      
    console.log('\nSample event timestamps:');
    recentEvents?.forEach(e => {
      const eventDate = new Date(e.timestamp);
      const daysAgo = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`${e.country}: ${e.timestamp} (${Math.floor(daysAgo)} days from now) [${e.latitude}, ${e.longitude}]`);
    });
    
    // Check how many events fall within different time ranges
    const { count: within7d } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .in('country', ['Israel', 'Palestine', 'Gaza'])
      .not('latitude', 'is', null)
      .gte('timestamp', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
    const { count: within30d } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .in('country', ['Israel', 'Palestine', 'Gaza'])
      .not('latitude', 'is', null)
      .gte('timestamp', thirtyDaysAgo.toISOString());
      
    console.log('\nMiddle East events with coordinates:');
    console.log(`Within 7 days: ${within7d}`);
    console.log(`Within 30 days: ${within30d}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkEventTimestamps().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
});