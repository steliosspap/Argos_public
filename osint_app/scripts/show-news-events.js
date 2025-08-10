#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function showNewsEvents() {
  console.log('🎯 Events ingested from news channel:\n');

  // Get all news channel events
  const { data: newsEvents, error } = await supabase
    .from('events')
    .select('*')
    .eq('channel', 'news')
    .order('timestamp', { ascending: false });
  
  if (error) {
    console.error('Error fetching news events:', error);
    return;
  }

  console.log(`Total events from news: ${newsEvents.length}\n`);

  // Show event details
  newsEvents.forEach((event, index) => {
    console.log(`${index + 1}. ${event.title}`);
    console.log(`   Country: ${event.country}`);
    console.log(`   Severity: ${event.severity}`);
    console.log(`   Timestamp: ${new Date(event.timestamp).toLocaleString()}`);
    console.log(`   Summary: ${event.summary?.substring(0, 100)}...`);
    if (event.latitude && event.longitude) {
      console.log(`   Location: ${event.latitude}, ${event.longitude}`);
    }
    console.log(`   Source: ${event.source_url}`);
    console.log('');
  });

  // Show severity distribution
  const severityCount = newsEvents.reduce((acc, event) => {
    acc[event.severity] = (acc[event.severity] || 0) + 1;
    return acc;
  }, {});

  console.log('Severity Distribution:');
  Object.entries(severityCount).forEach(([severity, count]) => {
    console.log(`  ${severity}: ${count} events`);
  });

  // Show country distribution
  const countryCount = newsEvents.reduce((acc, event) => {
    acc[event.country] = (acc[event.country] || 0) + 1;
    return acc;
  }, {});

  console.log('\nTop Countries:');
  Object.entries(countryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .forEach(([country, count]) => {
      console.log(`  ${country}: ${count} events`);
    });
}

showNewsEvents().catch(console.error);