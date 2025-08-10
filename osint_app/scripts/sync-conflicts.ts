#!/usr/bin/env node

/**
 * Real-Time Conflict Intelligence Sync
 * Automatically syncs Supabase conflicts table with recent news articles
 * 
 * Usage:
 *   npm run sync-conflicts
 *   node scripts/sync-conflicts.js --test
 *   node scripts/sync-conflicts.js --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { 
  detectConflictFromText, 
  generateConflictHash, 
  resolveCountryToRegion,
  estimateConflictSeverity 
} from '../src/utils/resolve-conflict-region';

// Environment setup
import { config } from 'dotenv';
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  region?: string;
  country?: string;
  date: string;
  url?: string;
  summary?: string;
  tags: string[];
  escalation_score?: number;
  created_at: string;
}

interface ConflictRecord {
  id?: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  conflict_type: string;
  status: string;
  description: string;
  escalation_score: number;
  start_date: string;
  updated_at: string;
  source_article_id: string;
  headline_hash: string;
  sync_source: string;
  auto_generated: boolean;
  last_news_update: string;
  conflict_hash: string;
  confidence_score: number;
}

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isTest = args.includes('--test');

/**
 * Logs sync operations to the database for monitoring
 */
async function logSyncOperation(
  operation: string, 
  affectedRows: number = 0, 
  message: string, 
  details?: any
) {
  try {
    await supabase
      .from('conflict_sync_log')
      .insert({
        operation,
        affected_rows: affectedRows,
        message,
        details: details ? JSON.stringify(details) : null
      });
  } catch (error) {
    console.warn('⚠️  Failed to log sync operation:', error);
  }
}

/**
 * Fetches recent high-escalation news articles
 */
async function fetchRecentHighEscalationNews(): Promise<NewsArticle[]> {
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  
  console.log('📰 Fetching recent high-escalation news articles...');
  
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .gte('created_at', twelveHoursAgo)
    .gte('escalation_score', 4)
    .order('escalation_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error fetching news:', error);
    await logSyncOperation('FETCH_NEWS_ERROR', 0, `Error fetching news: ${error.message}`);
    return [];
  }

  console.log(`📊 Found ${data?.length || 0} high-escalation articles from last 12 hours`);
  await logSyncOperation('FETCH_NEWS', data?.length || 0, 'Successfully fetched recent high-escalation news');
  
  return data || [];
}

/**
 * Processes news articles to detect conflicts
 */
async function processNewsForConflicts(articles: NewsArticle[]): Promise<ConflictRecord[]> {
  console.log('🔍 Processing articles for conflict detection...');
  
  const conflicts: ConflictRecord[] = [];
  const processedHashes = new Set<string>();

  for (const article of articles) {
    try {
      // Detect if article is conflict-related
      const detection = detectConflictFromText(
        article.headline,
        article.summary,
        article.tags
      );

      if (!detection.isConflictRelated || detection.confidence < 0.4) {
        continue;
      }

      // Use detected location or fall back to article's location
      const country = detection.country || article.country;
      const region = detection.region || article.region;

      if (!country || !region) {
        console.log(`⚠️  Skipping article - no location detected: ${article.headline}`);
        continue;
      }

      // Generate conflict hash for deduplication
      const conflictHash = generateConflictHash(country, region, detection.conflictType);
      
      // Skip if we already processed this conflict in this batch
      if (processedHashes.has(conflictHash)) {
        continue;
      }
      processedHashes.add(conflictHash);

      // Get coordinates
      const locationData = resolveCountryToRegion(country);
      if (!locationData) {
        console.log(`⚠️  No coordinates found for: ${country}`);
        continue;
      }

      // Estimate severity
      const severity = estimateConflictSeverity(
        article.headline,
        article.summary,
        article.escalation_score
      );

      // Create conflict record
      const conflict: ConflictRecord = {
        name: `${country} - ${article.headline.substring(0, 50)}...`,
        country: locationData.country,
        region: locationData.region,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        conflict_type: detection.conflictType,
        status: 'active',
        description: article.summary || article.headline,
        escalation_score: severity,
        start_date: article.date,
        updated_at: new Date().toISOString(),
        source_article_id: article.id,
        headline_hash: Buffer.from(article.headline).toString('base64').substring(0, 20),
        sync_source: 'news_sync',
        auto_generated: true,
        last_news_update: new Date().toISOString(),
        conflict_hash: conflictHash,
        confidence_score: detection.confidence
      };

      conflicts.push(conflict);
      
      console.log(`✅ Detected conflict: ${conflict.name} (Score: ${severity}, Confidence: ${detection.confidence.toFixed(2)})`);
      
    } catch (error) {
      console.error(`❌ Error processing article ${article.id}:`, error);
    }
  }

  console.log(`🎯 Processed ${articles.length} articles, detected ${conflicts.length} conflicts`);
  await logSyncOperation('PROCESS_ARTICLES', conflicts.length, `Processed ${articles.length} articles, detected ${conflicts.length} conflicts`);
  
  return conflicts;
}

/**
 * Syncs conflicts to the database
 */
async function syncConflictsToDatabase(conflicts: ConflictRecord[]): Promise<void> {
  if (conflicts.length === 0) {
    console.log('📭 No conflicts to sync');
    return;
  }

  console.log(`🔄 Syncing ${conflicts.length} conflicts to database...`);
  
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const conflict of conflicts) {
    if (isDryRun) {
      console.log(`[DRY RUN] Would sync: ${conflict.name}`);
      continue;
    }

    try {
      // Check if conflict already exists
      const { data: existing, error: checkError } = await supabase
        .from('conflicts')
        .select('id, escalation_score, updated_at')
        .eq('conflict_hash', conflict.conflict_hash)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        // Use asymmetric escalation calculation for updates
        const shouldUpdate = conflict.escalation_score > existing.escalation_score ||
                           new Date(conflict.updated_at) > new Date(existing.updated_at);

        if (shouldUpdate) {
          // First update basic conflict info
          const { error: updateError } = await supabase
            .from('conflicts')
            .update({
              last_news_update: conflict.last_news_update,
              status: 'active', // Reactivate if it was resolved
              description: conflict.description,
              source_article_id: conflict.source_article_id
            })
            .eq('id', existing.id);

          if (updateError) {
            throw updateError;
          }

          // Then calculate asymmetric escalation with recent events
          const { data: newScore, error: escalationError } = await supabase
            .rpc('calculate_asymmetric_escalation', {
              p_conflict_id: existing.id,
              p_new_events: [{
                id: conflict.source_article_id,
                escalation_score: conflict.escalation_score
              }]
            });

          if (escalationError) {
            console.warn(`⚠️  Failed to update escalation for ${conflict.name}: ${escalationError.message}`);
          } else {
            console.log(`🔄 Updated: ${conflict.name} (escalation: ${existing.escalation_score} → ${newScore})`);
          }
          
          updatedCount++;
        } else {
          console.log(`⏭️  Skipped (no update needed): ${conflict.name}`);
          skippedCount++;
        }
      } else {
        // Insert new conflict
        const { error: insertError } = await supabase
          .from('conflicts')
          .insert(conflict);

        if (insertError) {
          throw insertError;
        }

        console.log(`➕ Inserted: ${conflict.name}`);
        insertedCount++;
      }

    } catch (error) {
      console.error(`❌ Error syncing conflict ${conflict.name}:`, error);
    }
  }

  const summary = `Sync complete: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`;
  console.log(`📊 ${summary}`);
  
  await logSyncOperation(
    'SYNC_CONFLICTS', 
    insertedCount + updatedCount, 
    summary,
    { inserted: insertedCount, updated: updatedCount, skipped: skippedCount }
  );
}

/**
 * Expires inactive conflicts (marks as resolved after 48h)
 */
async function expireInactiveConflicts(): Promise<void> {
  if (isDryRun) {
    console.log('[DRY RUN] Would check for inactive conflicts to expire');
    return;
  }

  console.log('⏰ Checking for inactive conflicts to expire...');
  
  try {
    const { data, error } = await supabase.rpc('expire_inactive_conflicts');
    
    if (error) {
      throw error;
    }

    const expiredCount = data || 0;
    if (expiredCount > 0) {
      console.log(`📉 Expired ${expiredCount} inactive conflicts`);
    } else {
      console.log('✅ No conflicts needed expiration');
    }
    
  } catch (error) {
    console.error('❌ Error expiring conflicts:', error);
    await logSyncOperation('EXPIRE_CONFLICTS_ERROR', 0, `Error expiring conflicts: ${error}`);
  }
}

/**
 * Creates test articles for development
 */
async function createTestArticles(): Promise<void> {
  console.log('🧪 Creating test articles for conflict sync...');
  
  const testArticles = [
    {
      headline: 'Israeli forces launch major operation in Gaza, dozens killed',
      source: 'BBC News',
      region: 'Middle East',
      country: 'Palestine',
      date: new Date().toISOString(),
      summary: 'Israeli military forces conducted extensive operations in Gaza Strip resulting in civilian casualties and destruction',
      tags: ['military', 'conflict', 'gaza', 'israel'],
      escalation_score: 9,
      created_at: new Date().toISOString()
    },
    {
      headline: 'Ukraine reports heavy fighting near Bakhmut as Russian offensive continues',
      source: 'Reuters',
      region: 'Europe', 
      country: 'Ukraine',
      date: new Date().toISOString(),
      summary: 'Ukrainian forces face intense Russian attacks near the strategic city of Bakhmut',
      tags: ['war', 'ukraine', 'russia', 'military'],
      escalation_score: 8,
      created_at: new Date().toISOString()
    },
    {
      headline: 'Sudan ceasefire violations reported as fighting erupts in Khartoum',
      source: 'Al Jazeera',
      region: 'Africa',
      country: 'Sudan', 
      date: new Date().toISOString(),
      summary: 'Renewed clashes between military factions in Sudan capital despite ceasefire agreement',
      tags: ['sudan', 'conflict', 'ceasefire', 'khartoum'],
      escalation_score: 7,
      created_at: new Date().toISOString()
    },
    {
      headline: 'Myanmar military conducts airstrikes on rebel positions',
      source: 'Associated Press',
      region: 'Asia',
      country: 'Myanmar',
      date: new Date().toISOString(), 
      summary: 'Military junta launches aerial bombardment against opposition forces in several regions',
      tags: ['myanmar', 'military', 'airstrikes', 'rebels'],
      escalation_score: 6,
      created_at: new Date().toISOString()
    },
    {
      headline: 'Border tensions rise between India and Pakistan over Kashmir dispute',
      source: 'Times of India',
      region: 'Asia',
      country: 'India',
      date: new Date().toISOString(),
      summary: 'Military buildup reported along Line of Control as diplomatic tensions escalate',
      tags: ['india', 'pakistan', 'kashmir', 'border', 'tension'],
      escalation_score: 5,
      created_at: new Date().toISOString()
    }
  ];

  if (isDryRun) {
    console.log('[DRY RUN] Would create test articles');
    testArticles.forEach(article => {
      console.log(`[DRY RUN] Test article: ${article.headline}`);
    });
    return;
  }

  try {
    const { error } = await supabase
      .from('news')
      .insert(testArticles);

    if (error) {
      throw error;
    }

    console.log(`✅ Created ${testArticles.length} test articles`);
    await logSyncOperation('CREATE_TEST_ARTICLES', testArticles.length, 'Created test articles for sync testing');
    
  } catch (error) {
    console.error('❌ Error creating test articles:', error);
  }
}

/**
 * Main sync function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Real-Time Conflict Intelligence Sync...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made to database');
  }
  
  if (isTest) {
    console.log('🧪 TEST MODE - Creating sample articles');
    await createTestArticles();
  }

  try {
    // Start sync operation
    await logSyncOperation('SYNC_START', 0, 'Starting conflict sync operation');

    // Step 1: Fetch recent high-escalation news
    const articles = await fetchRecentHighEscalationNews();
    
    if (articles.length === 0) {
      console.log('📭 No recent high-escalation articles found');
      await logSyncOperation('SYNC_COMPLETE', 0, 'No articles to process');
      return;
    }

    // Step 2: Process articles for conflict detection
    const conflicts = await processNewsForConflicts(articles);
    
    // Step 3: Sync conflicts to database
    await syncConflictsToDatabase(conflicts);
    
    // Step 4: Expire inactive conflicts
    await expireInactiveConflicts();
    
    console.log('✅ Conflict sync completed successfully');
    await logSyncOperation('SYNC_COMPLETE', conflicts.length, 'Conflict sync completed successfully');

  } catch (error) {
    console.error('❌ Conflict sync failed:', error);
    await logSyncOperation('SYNC_ERROR', 0, `Conflict sync failed: ${error}`);
    process.exit(1);
  }
}

// Run the sync
main().catch(console.error);

export { main as syncConflicts };