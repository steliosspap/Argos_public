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

// Configuration
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 50;

let isRunning = false;

async function syncBatch() {
  if (isRunning) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  
  try {
    // Get unprocessed news articles
    const { data: unprocessedNews, error: newsError } = await supabase
      .from('news')
      .select('*')
      .is('processed_for_events', null)
      .order('published_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (newsError) {
      console.error('Error fetching unprocessed news:', newsError);
      return;
    }

    if (!unprocessedNews || unprocessedNews.length === 0) {
      console.log('✅ No new articles to process');
      return;
    }

    console.log(`\n📰 Processing ${unprocessedNews.length} new articles...`);

    // Sync news to events
    const syncResults = await syncNewsToEventsTable(supabase, unprocessedNews, {
      batchSize: 10,
      updateEscalation: false
    });

    console.log(`✅ Sync complete: ${syncResults.inserted} events created, ${syncResults.skipped} skipped`);

    // Mark news as processed
    const processedIds = unprocessedNews.map(n => n.id);
    const { error: updateError } = await supabase
      .from('news')
      .update({ processed_for_events: true })
      .in('id', processedIds);

    if (updateError) {
      console.error('Error marking news as processed:', updateError);
    }

    // Update escalation scores if we inserted new events
    if (syncResults.inserted > 0) {
      console.log('📈 Updating escalation scores...');
      const escalationResults = await updateConflictZoneEscalationImproved(supabase);
      console.log(`✅ Updated ${escalationResults.updated} conflict zones`);
    }

  } catch (error) {
    console.error('❌ Sync error:', error);
  } finally {
    isRunning = false;
  }
}

// Set up real-time listener for new news
async function setupRealtimeSync() {
  console.log('🎯 Setting up real-time news sync...');
  
  const channel = supabase
    .channel('news-sync')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'news'
      },
      async (payload) => {
        console.log(`\n🆕 New article detected: ${payload.new.title?.substring(0, 50)}...`);
        // Wait a bit to let more articles accumulate
        setTimeout(() => syncBatch(), 10000); // 10 seconds
      }
    )
    .subscribe();

  return channel;
}

// Main function
async function main() {
  console.log('🚀 Starting continuous event sync service...');
  console.log(`⏰ Sync interval: ${SYNC_INTERVAL / 1000} seconds`);
  console.log(`📦 Batch size: ${BATCH_SIZE} articles\n`);

  // Initial sync
  await syncBatch();

  // Set up real-time sync
  const channel = await setupRealtimeSync();

  // Set up periodic sync
  const interval = setInterval(syncBatch, SYNC_INTERVAL);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down sync service...');
    clearInterval(interval);
    supabase.removeChannel(channel);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Shutting down sync service...');
    clearInterval(interval);
    supabase.removeChannel(channel);
    process.exit(0);
  });

  console.log('✅ Sync service is running. Press Ctrl+C to stop.\n');
}

// Run the service
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});