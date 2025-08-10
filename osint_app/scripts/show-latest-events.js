#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function showLatestEvents() {
  console.log('🎯 Latest events ingested from news channel:\n');

  // Get most recent news channel events
  const { data: newsEvents, error } = await supabase
    .from('events')
    .select('*')
    .eq('channel', 'news')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error fetching news events:', error);
    return;
  }

  console.log(`Showing ${newsEvents.length} most recent events:\n`);

  // Show event details
  newsEvents.forEach((event, index) => {
    console.log(`${index + 1}. ${event.title}`);
    console.log(`   Country: ${event.country}`);
    console.log(`   Region: ${event.region}`);
    console.log(`   Severity: ${event.severity}`);
    console.log(`   Reliability: ${event.reliability}/10`);
    console.log(`   Timestamp: ${new Date(event.timestamp).toLocaleString()}`);
    console.log(`   Summary: ${event.summary}`);
    if (event.latitude && event.longitude) {
      console.log(`   Coordinates: ${event.latitude}, ${event.longitude}`);
    }
    console.log(`   Tags: ${event.event_classifier?.join(', ') || 'None'}`);
    console.log(`   Created: ${new Date(event.created_at).toLocaleString()}`);
    console.log('');
  });
}

showLatestEvents().catch(console.error);