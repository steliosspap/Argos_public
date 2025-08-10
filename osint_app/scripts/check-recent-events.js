#!/usr/bin/env node

/**
 * Script to check recent events in the database and diagnose why they're not showing on the map
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentEvents() {
  console.log('🔍 Checking recent events in the database...\n');
  
  // Get events from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: recentEvents, error } = await supabase
    .from('events')
    .select('*')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }
  
  console.log(`Found ${recentEvents.length} events from the last 7 days\n`);
  
  // Analyze events
  let withCoords = 0;
  let withoutCoords = 0;
  let countriesNotInList = [];
  let sourceTypes = {};
  
  const conflictCountries = [
    'Ukraine', 'Russia', 'Myanmar', 'Sudan', 'South Sudan',
    'Israel', 'Palestine', 'Gaza', 'West Bank', 'Lebanon',
    'Syria', 'Iraq', 'Yemen', 'Somalia', 'Mali', 'Burkina Faso',
    'Nigeria', 'Niger', 'Cameroon', 'Chad', 'Ethiopia',
    'Democratic Republic of the Congo', 'DRC', 'Congo',
    'Afghanistan', 'Pakistan', 'Mexico',
    'Libya', 'Egypt', 'Iran', 'Turkey', 'Algeria', 'Tunisia',
    'Central African Republic', 'Mozambique', 'Kenya',
    'Colombia', 'Philippines', 'India', 'Thailand'
  ];
  
  recentEvents.forEach(event => {
    // Check coordinates
    if (event.latitude && event.longitude) {
      withCoords++;
    } else {
      withoutCoords++;
    }
    
    // Check country
    if (event.country && !conflictCountries.includes(event.country)) {
      if (!countriesNotInList.includes(event.country)) {
        countriesNotInList.push(event.country);
      }
    }
    
    // Track source types
    const source = event.source_type || event.channel || 'unknown';
    sourceTypes[source] = (sourceTypes[source] || 0) + 1;
    
    // Log event details
    console.log(`📍 Event: ${event.title?.substring(0, 60)}...`);
    console.log(`   Created: ${new Date(event.created_at).toLocaleString()}`);
    console.log(`   Country: ${event.country || 'NULL'} ${event.country && !conflictCountries.includes(event.country) ? '❌ (NOT IN FILTER LIST)' : '✅'}`);
    console.log(`   Coordinates: ${event.latitude ? `${event.latitude}, ${event.longitude} ✅` : 'NULL ❌'}`);
    console.log(`   Source: ${source}`);
    console.log('');
  });
  
  console.log('\n📊 SUMMARY:');
  console.log(`- Events with coordinates: ${withCoords} ✅`);
  console.log(`- Events without coordinates: ${withoutCoords} ❌`);
  console.log(`- Countries not in filter list: ${countriesNotInList.length > 0 ? countriesNotInList.join(', ') : 'None'}`);
  console.log(`- Source types: ${JSON.stringify(sourceTypes, null, 2)}`);
  
  console.log('\n🚨 DIAGNOSIS:');
  if (withoutCoords > 0) {
    console.log(`❌ ${withoutCoords} events have no coordinates and won't show on the map`);
  }
  if (countriesNotInList.length > 0) {
    console.log(`❌ Events from these countries are being filtered out: ${countriesNotInList.join(', ')}`);
    console.log('   (The API has been updated to allow disabling this filter)');
  }
  if (withCoords === 0) {
    console.log('❌ NO recent events have coordinates - this is why nothing shows on the map!');
    console.log('   The intelligent ingestion needs to be enhanced to geocode locations.');
  }
}

checkRecentEvents().catch(console.error);