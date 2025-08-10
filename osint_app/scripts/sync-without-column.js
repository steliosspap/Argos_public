#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

async function syncRecentNews() {
  console.log('🔄 Starting news to events sync...\n');
  
  try {
    // Get recent news articles from the last 24 hours
    const { data: recentNews, error: newsError } = await supabase
      .from('news')
      .select('*')
      .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: false })
      .limit(100);

    if (newsError) {
      console.error('Error fetching news:', newsError);
      return;
    }

    console.log(`📰 Found ${recentNews?.length || 0} news articles from the last 24 hours\n`);

    if (recentNews && recentNews.length > 0) {
      // Sync news to events table
      console.log('📍 Converting news to map events...');
      const syncResults = await syncNewsToEventsTable(supabase, recentNews, {
        batchSize: 10,
        updateEscalation: false
      });

      console.log('\n✅ Sync Results:');
      console.log(`  - Processed: ${syncResults.processed}`);
      console.log(`  - Converted: ${syncResults.converted}`);
      console.log(`  - Inserted: ${syncResults.inserted}`);
      console.log(`  - Skipped: ${syncResults.skipped}`);
      console.log(`  - Errors: ${syncResults.errors}`);
    }

    // Update escalation scores
    console.log('\n📈 Updating conflict escalation scores...');
    const escalationResults = await updateConflictZoneEscalationImproved(supabase);
    
    console.log('\n✅ Escalation Update Results:');
    console.log(`  - Updated: ${escalationResults.updated} conflicts`);
    console.log(`  - Errors: ${escalationResults.errors}`);

    // Check current event count
    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total events in database: ${eventCount}`);

  } catch (error) {
    console.error('\n❌ Error during sync:', error);
  }
}

// Run continuous sync
async function continuousSync() {
  console.log('🚀 Starting continuous sync service...\n');
  console.log('⏰ Sync interval: 5 minutes\n');
  
  // Initial sync
  await syncRecentNews();
  
  // Set up interval
  setInterval(async () => {
    console.log('\n' + '='.repeat(60) + '\n');
    console.log(`⏰ Running scheduled sync at ${new Date().toISOString()}`);
    await syncRecentNews();
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('\n✅ Continuous sync service is running. Press Ctrl+C to stop.\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down sync service...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down sync service...');
  process.exit(0);
});

// Start the service
continuousSync().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});