import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get recent events
const { data: events, error } = await supabase
  .from('events')
  .select('id, title, country, city, timestamp, severity, channel')
  .order('timestamp', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error fetching events:', error);
  process.exit(1);
}

console.log(`\nFound ${events.length} recent events:\n`);

events.forEach((event, index) => {
  console.log(`${index + 1}. ${event.title}`);
  console.log(`   Location: ${event.city || 'Unknown'}, ${event.country}`);
  console.log(`   Time: ${new Date(event.timestamp).toLocaleString()}`);
  console.log(`   Severity: ${event.severity} | Channel: ${event.channel}`);
  console.log('');
});