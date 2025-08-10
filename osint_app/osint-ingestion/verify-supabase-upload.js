#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '../../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyUpload() {
  console.log('=== VERIFYING SUPABASE UPLOAD ===\n');
  
  // Get recent events (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: events, error: eventsError, count } = await supabase
    .from('conflict_events')
    .select('*', { count: 'exact' })
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (eventsError) {
    console.error('Error fetching events:', eventsError);
    return;
  }
  
  console.log(`Total events in last 24 hours: ${count}`);
  console.log(`\nShowing last 5 events:\n`);
  
  if (events && events.length > 0) {
    events.forEach((event, index) => {
      console.log(`Event ${index + 1}:`);
      console.log(`  Title: ${event.title}`);
      console.log(`  Source: ${event.source}`);
      console.log(`  Date: ${event.event_date}`);
      console.log(`  Country: ${event.country}`);
      console.log(`  Created: ${event.created_at}`);
      console.log('');
    });
  } else {
    console.log('No events found in the last 24 hours');
  }
  
  // Check for events from the pipeline (with specific characteristics)
  const { data: pipelineEvents, error: pipelineError } = await supabase
    .from('conflict_events')
    .select('id, title, source, raw_content')
    .ilike('raw_content', '%search_round%')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (!pipelineError && pipelineEvents && pipelineEvents.length > 0) {
    console.log('\nEvents from argos-master-pipeline detected:');
    pipelineEvents.forEach(event => {
      console.log(`- ${event.title} (${event.source})`);
    });
  }
}

verifyUpload();