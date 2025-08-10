#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fixEventCoordinates } from './coordinate-fixer.js';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExistingEvents() {
  console.log('🔧 Starting coordinate fix for existing events...\n');

  // Fetch events with missing or invalid coordinates
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .or('latitude.is.null,longitude.is.null,location.is.null')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching events:', error);
    return;
  }

  console.log(`Found ${events.length} events to check\n`);

  // Fix coordinates
  const { events: fixedEvents, stats } = fixEventCoordinates(events);

  console.log('\n📊 Coordinate Fix Statistics:');
  console.log(`  ✅ Already valid: ${stats.already_valid}`);
  console.log(`  🔧 Fixed: ${stats.fixed}`);
  console.log(`  ❌ Unfixable: ${stats.unfixable}`);
  
  if (stats.fixed > 0) {
    console.log('\n📍 Fix methods used:');
    Object.entries(stats.methods).forEach(([method, count]) => {
      console.log(`  - ${method}: ${count}`);
    });
  }

  // Update events with fixed coordinates
  if (stats.fixed > 0) {
    console.log('\n💾 Updating database...');
    
    let updateCount = 0;
    let errorCount = 0;
    
    for (const event of fixedEvents) {
      if (event.coordinate_method && event.coordinate_method !== 'existing_valid') {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            latitude: event.latitude,
            longitude: event.longitude,
            location: event.location
          })
          .eq('id', event.id);
        
        if (updateError) {
          console.error(`Error updating event ${event.id}:`, updateError);
          errorCount++;
        } else {
          updateCount++;
          if (updateCount % 10 === 0) {
            process.stdout.write(`  Updated ${updateCount} events...\r`);
          }
        }
      }
    }
    
    console.log(`\n\n✅ Successfully updated ${updateCount} events`);
    if (errorCount > 0) {
      console.log(`❌ Failed to update ${errorCount} events`);
    }
  }

  // Show sample of fixed events
  if (stats.fixed > 0) {
    console.log('\n📋 Sample of fixed events:');
    fixedEvents
      .filter(e => e.coordinate_method && e.coordinate_method !== 'existing_valid')
      .slice(0, 5)
      .forEach(event => {
        console.log(`\n  ${event.title}`);
        console.log(`  Country: ${event.country}, Region: ${event.region}`);
        console.log(`  Coordinates: ${event.latitude}, ${event.longitude}`);
        console.log(`  Method: ${event.coordinate_method} (confidence: ${event.coordinate_confidence})`);
      });
  }
}

// Also check events that might have invalid coordinates (0,0 or out of range)
async function checkAllEvents() {
  console.log('\n\n🔍 Checking ALL events for invalid coordinates...\n');
  
  const { data: allEvents, error } = await supabase
    .from('events')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  
  if (error) {
    console.error('Error fetching all events:', error);
    return;
  }
  
  const invalidEvents = allEvents.filter(event => {
    const lat = event.latitude;
    const lng = event.longitude;
    return (
      (lat === 0 && lng === 0) || // Null island
      lat < -90 || lat > 90 ||   // Invalid latitude
      lng < -180 || lng > 180     // Invalid longitude
    );
  });
  
  if (invalidEvents.length > 0) {
    console.log(`Found ${invalidEvents.length} events with invalid coordinates`);
    
    // Fix these too
    const { events: fixedEvents, stats } = fixEventCoordinates(invalidEvents);
    
    console.log('\n📊 Invalid Coordinate Fix Statistics:');
    console.log(`  🔧 Fixed: ${stats.fixed}`);
    console.log(`  ❌ Unfixable: ${stats.unfixable}`);
    
    // Update these events
    if (stats.fixed > 0) {
      console.log('\n💾 Updating invalid coordinate events...');
      
      let updateCount = 0;
      for (const event of fixedEvents) {
        if (event.coordinate_method) {
          const { error: updateError } = await supabase
            .from('events')
            .update({
              latitude: event.latitude,
              longitude: event.longitude,
              location: event.location
            })
            .eq('id', event.id);
          
          if (!updateError) {
            updateCount++;
          }
        }
      }
      
      console.log(`✅ Fixed ${updateCount} events with invalid coordinates`);
    }
  } else {
    console.log('✅ No events found with invalid coordinates');
  }
}

// Run the fix
fixExistingEvents()
  .then(() => checkAllEvents())
  .then(() => {
    console.log('\n✨ Coordinate fix complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });