#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Generate consistent hash for events
function generateEventHash(event) {
  const content = [
    event.title?.trim().toLowerCase(),
    event.country?.trim().toLowerCase(),
    (event.city || event.region)?.trim().toLowerCase(),
    new Date(event.timestamp).toISOString().split('T')[0] // Daily dedup
  ].filter(Boolean).join('|');
  
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function analyzeDuplicates() {
  console.log('🔍 Analyzing duplicate events...\n');
  
  // Fetch all events
  const { data: allEvents, error } = await supabase
    .from('events')
    .select('*')
    .order('timestamp', { ascending: false });
    
  if (error) {
    console.error('Error fetching events:', error);
    return null;
  }
  
  console.log(`Total events in database: ${allEvents.length}`);
  
  // Group by hash to find duplicates
  const hashGroups = {};
  allEvents.forEach(event => {
    const hash = generateEventHash(event);
    if (!hashGroups[hash]) {
      hashGroups[hash] = [];
    }
    hashGroups[hash].push(event);
  });
  
  // Find duplicates
  const duplicateGroups = Object.entries(hashGroups)
    .filter(([_, events]) => events.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`Unique event signatures: ${Object.keys(hashGroups).length}`);
  console.log(`Duplicate groups found: ${duplicateGroups.length}`);
  
  // Calculate statistics
  const totalDuplicates = duplicateGroups.reduce((sum, [_, events]) => sum + events.length - 1, 0);
  console.log(`Total duplicate events to remove: ${totalDuplicates}`);
  console.log(`Events after cleanup: ${allEvents.length - totalDuplicates}\n`);
  
  // Show sample duplicates
  console.log('Sample duplicate groups:');
  duplicateGroups.slice(0, 3).forEach(([hash, events]) => {
    console.log(`\nHash: ${hash.substring(0, 8)}...`);
    console.log(`Title: "${events[0].title}"`);
    console.log(`Count: ${events.length} duplicates`);
    console.log(`Countries: ${[...new Set(events.map(e => e.country))].join(', ')}`);
    console.log(`Date: ${new Date(events[0].timestamp).toLocaleDateString()}`);
  });
  
  return { hashGroups, duplicateGroups, totalDuplicates };
}

async function cleanupDuplicates(dryRun = true) {
  const analysis = await analyzeDuplicates();
  if (!analysis) return;
  
  const { hashGroups, duplicateGroups, totalDuplicates } = analysis;
  
  if (duplicateGroups.length === 0) {
    console.log('\n✅ No duplicates found!');
    return;
  }
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
    console.log('Run with --execute to perform cleanup\n');
    return;
  }
  
  console.log('\n🧹 Starting cleanup...\n');
  
  let deleted = 0;
  let updated = 0;
  let errors = 0;
  
  // Process each duplicate group
  for (const [hash, events] of duplicateGroups) {
    // Sort by created_at to keep the oldest
    events.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const keepEvent = events[0];
    const deleteEvents = events.slice(1);
    
    // Update the kept event with content_hash
    const { error: updateError } = await supabase
      .from('events')
      .update({ content_hash: hash })
      .eq('id', keepEvent.id);
      
    if (updateError) {
      console.error(`Error updating event ${keepEvent.id}:`, updateError);
      errors++;
    } else {
      updated++;
    }
    
    // Delete duplicates
    const deleteIds = deleteEvents.map(e => e.id);
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .in('id', deleteIds);
      
    if (deleteError) {
      console.error(`Error deleting duplicates:`, deleteError);
      errors += deleteIds.length;
    } else {
      deleted += deleteIds.length;
    }
    
    // Progress update
    if (deleted % 50 === 0) {
      console.log(`Progress: ${deleted} duplicates removed...`);
    }
  }
  
  // Update remaining unique events with content_hash
  console.log('\n📝 Updating unique events with content hashes...');
  
  for (const [hash, events] of Object.entries(hashGroups)) {
    if (events.length === 1) {
      const { error: updateError } = await supabase
        .from('events')
        .update({ content_hash: hash })
        .eq('id', events[0].id);
        
      if (updateError) {
        console.error(`Error updating event ${events[0].id}:`, updateError);
        errors++;
      } else {
        updated++;
      }
    }
  }
  
  console.log('\n✅ Cleanup complete!');
  console.log(`   Duplicates removed: ${deleted}`);
  console.log(`   Events updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  
  // Verify final state
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
    
  console.log(`   Final event count: ${count}`);
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  
  console.log('🧹 Argos Event Deduplication Tool\n');
  console.log('This tool will:');
  console.log('1. Analyze all events for duplicates');
  console.log('2. Keep the oldest event from each duplicate group');
  console.log('3. Add content_hash to all events for future deduplication');
  console.log('4. Remove all duplicate events\n');
  
  await cleanupDuplicates(!execute);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});