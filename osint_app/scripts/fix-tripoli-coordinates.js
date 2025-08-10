#!/usr/bin/env node

/**
 * Fix Tripoli coordinate mismatches in the database
 * Corrects events where Lebanon/Libya context doesn't match coordinates
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Correct coordinates for each Tripoli
const TRIPOLI_COORDS = {
  lebanon: { lat: 34.4346, lng: 35.8362 },
  libya: { lat: 32.8872, lng: 13.1913 }
};

async function fixTripoliCoordinates() {
  console.log('Fetching events mentioning Tripoli...\n');
  
  // Get all events that mention Tripoli
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .or('title.ilike.%tripoli%,summary.ilike.%tripoli%')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching events:', error);
    return;
  }

  console.log(`Found ${events.length} events mentioning Tripoli\n`);

  let fixedCount = 0;
  let alreadyCorrectCount = 0;

  for (const event of events) {
    const title = event.title?.toLowerCase() || '';
    const summary = event.summary?.toLowerCase() || '';
    const fullText = `${title} ${summary}`;
    
    // Determine the correct country based on context
    let correctCountry = null;
    let correctCity = 'Tripoli';
    
    // Look for explicit country mentions
    if (fullText.includes('lebanon') || fullText.includes('lebanese')) {
      correctCountry = 'Lebanon';
    } else if (fullText.includes('libya') || fullText.includes('libyan')) {
      correctCountry = 'Libya';
    } else {
      // Try to infer from other context clues
      if (fullText.includes('israeli') && fullText.includes('strike')) {
        // Israeli strikes in this context are more likely in Lebanon
        correctCountry = 'Lebanon';
      } else if (fullText.includes('northern lebanon')) {
        correctCountry = 'Lebanon';
      } else if (fullText.includes('hezbollah')) {
        correctCountry = 'Lebanon';
      } else if (fullText.includes('gaddafi') || fullText.includes('haftar')) {
        correctCountry = 'Libya';
      }
    }
    
    // If we couldn't determine the country, check existing data
    if (!correctCountry && event.country) {
      if (event.country === 'Lebanon' || event.country === 'Libya') {
        correctCountry = event.country;
      }
    }
    
    // Skip if we couldn't determine the country
    if (!correctCountry) {
      console.log(`⚠️  Could not determine country for event: ${event.id}`);
      console.log(`   Title: ${event.title?.substring(0, 60)}...`);
      continue;
    }
    
    // Get the correct coordinates
    const coords = TRIPOLI_COORDS[correctCountry.toLowerCase()];
    if (!coords) continue;
    
    // Check if update is needed
    const needsUpdate = 
      event.country !== correctCountry ||
      event.city !== correctCity ||
      Math.abs((event.latitude || 0) - coords.lat) > 0.01 ||
      Math.abs((event.longitude || 0) - coords.lng) > 0.01;
    
    if (needsUpdate) {
      console.log(`Fixing event ${event.id}:`);
      console.log(`  Title: ${event.title?.substring(0, 60)}...`);
      console.log(`  Old: ${event.country} [${event.latitude}, ${event.longitude}]`);
      console.log(`  New: ${correctCountry} [${coords.lat}, ${coords.lng}]`);
      
      // Update the event
      const { error: updateError } = await supabase
        .from('events')
        .update({
          country: correctCountry,
          city: correctCity,
          latitude: coords.lat,
          longitude: coords.lng
        })
        .eq('id', event.id);
      
      if (updateError) {
        console.error(`  ❌ Error updating: ${updateError.message}`);
      } else {
        console.log(`  ✅ Fixed!`);
        fixedCount++;
      }
      console.log('');
    } else {
      alreadyCorrectCount++;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total events checked: ${events.length}`);
  console.log(`Events fixed: ${fixedCount}`);
  console.log(`Already correct: ${alreadyCorrectCount}`);
  
  // Also fix any events that have wrong country labels
  console.log('\nChecking for mislabeled countries...');
  
  // Fix events labeled as Libya but clearly about Lebanon
  const { data: mislabeled, error: mislabeledError } = await supabase
    .from('events')
    .select('*')
    .eq('country', 'Libya')
    .or('title.ilike.%lebanon%,summary.ilike.%lebanon%');
    
  if (!mislabeledError && mislabeled) {
    for (const event of mislabeled) {
      console.log(`\nFixing mislabeled event ${event.id}:`);
      console.log(`  Title: ${event.title?.substring(0, 60)}...`);
      
      const { error: updateError } = await supabase
        .from('events')
        .update({ country: 'Lebanon' })
        .eq('id', event.id);
        
      if (!updateError) {
        console.log(`  ✅ Changed country from Libya to Lebanon`);
        fixedCount++;
      }
    }
  }
}

// Run the fix
fixTripoliCoordinates().catch(console.error);