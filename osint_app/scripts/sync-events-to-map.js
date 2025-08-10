#!/usr/bin/env node

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Import the sync functions
const { syncNewsToEventsTable } = await import('../osint-ingestion/sync/syncEvents.js');
const { updateConflictZoneEscalationImproved } = await import('../osint-ingestion/sync/improvedEscalationUpdate.js');

async function syncEventsToMap() {
  console.log('🔄 Starting event sync to map...\n');

  try {
    // Get recent news articles that haven't been converted to events
    const { data: recentNews, error: newsError } = await supabase
      .from('news')
      .select('*')
      .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('published_at', { ascending: false })
      .limit(100);

    if (newsError) {
      console.error('Error fetching news:', newsError);
      return;
    }

    console.log(`📰 Found ${recentNews?.length || 0} recent news articles\n`);

    if (recentNews && recentNews.length > 0) {
      // Sync news to events table
      console.log('📍 Converting news to map events...');
      const syncResults = await syncNewsToEventsTable(supabase, recentNews, {
        batchSize: 10,
        updateEscalation: false // We'll do this separately
      });

      console.log('\n✅ Sync Results:');
      console.log(`  - Processed: ${syncResults.processed}`);
      console.log(`  - Converted: ${syncResults.converted}`);
      console.log(`  - Inserted: ${syncResults.inserted}`);
      console.log(`  - Skipped: ${syncResults.skipped}`);
      console.log(`  - Errors: ${syncResults.errors}`);

      // Show some details
      if (syncResults.details.length > 0) {
        console.log('\n📊 Event Details:');
        syncResults.details
          .filter(d => d.type === 'success' || d.type === 'converted')
          .slice(0, 5)
          .forEach(detail => {
            if (detail.type === 'success') {
              console.log(`  ✓ ${detail.event_title} - ${detail.severity} severity at ${detail.coordinates}`);
            } else if (detail.type === 'converted') {
              console.log(`  📍 ${detail.title} - ${detail.location} (confidence: ${detail.confidence})`);
            }
          });

        // Show skipped reasons
        const skippedDetails = syncResults.details.filter(d => d.type === 'skipped');
        if (skippedDetails.length > 0) {
          console.log(`\n⏭️  Skipped ${skippedDetails.length} items:`);
          const skipReasons = {};
          skippedDetails.forEach(detail => {
            skipReasons[detail.reason] = (skipReasons[detail.reason] || 0) + 1;
          });
          Object.entries(skipReasons).forEach(([reason, count]) => {
            console.log(`  - ${reason}: ${count} items`);
          });
        }
      }
    }

    // Update escalation scores
    console.log('\n📈 Updating conflict escalation scores...');
    const escalationResults = await updateConflictZoneEscalationImproved(supabase);
    
    console.log('\n✅ Escalation Update Results:');
    console.log(`  - Updated: ${escalationResults.updated} conflicts`);
    console.log(`  - Errors: ${escalationResults.errors}`);

    if (escalationResults.details.length > 0) {
      console.log('\n📊 Escalation Updates:');
      escalationResults.details
        .filter(d => d.type === 'updated')
        .forEach(detail => {
          console.log(`  - ${detail.conflict}: ${detail.previousScore} → ${detail.newScore} (${detail.eventCount} events)`);
        });
    }

    // Check current event count
    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total events in database: ${eventCount}`);

  } catch (error) {
    console.error('\n❌ Error during sync:', error);
  }
}

// Run the sync
syncEventsToMap().then(() => {
  console.log('\n✅ Sync process completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});