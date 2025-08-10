#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { validateEnvironment, printValidationResults } from '../osint-ingestion/utils/envValidator.js';

/**
 * Health check for OSINT pipeline
 * Tests all critical dependencies before running the full pipeline
 */
async function runHealthCheck() {
  console.log('🏥 OSINT Pipeline Health Check\n');

  let allHealthy = true;

  // 1. Environment Variables
  console.log('1️⃣ Checking Environment Variables...');
  const envValidation = validateEnvironment({ production: process.env.NODE_ENV === 'production' });
  const envHealthy = printValidationResults(envValidation);
  allHealthy = allHealthy && envHealthy;

  // 2. Database Connection & Table Verification
  console.log('2️⃣ Testing Database Connection & Tables...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Test core tables required for automated pipeline
    const tablesToTest = [
      { name: 'news', columns: 'id, title, source', description: 'News articles from RSS feeds' },
      { name: 'conflict_events', columns: 'id, title, region', description: 'Conflict events from news analysis' },
      { name: 'arms_deals', columns: 'id, buyer_country, weapon_system', description: 'Arms deals data' },
      { name: 'events', columns: 'id, title, location', description: 'Geographic events for map display' }
    ];

    for (const table of tablesToTest) {
      try {
        const { data, error } = await supabase
          .from(table.name)
          .select(table.columns)
          .limit(3);

        if (error) {
          console.log(`❌ ${table.name} table error: ${error.message}`);
          allHealthy = false;
        } else {
          console.log(`✅ ${table.name} table: ${data.length} records found - ${table.description}`);
          // Log sample data for verification (only in verbose mode)
          if (process.argv.includes('--verbose') && data.length > 0) {
            console.log(`   Sample: ${JSON.stringify(data[0])}`);
          }
        }
      } catch (tableError) {
        console.log(`❌ ${table.name} table test failed: ${tableError.message}`);
        allHealthy = false;
      }
    }

    // Test escalation scoring column (critical for analytics)
    try {
      const { data: escalationTest } = await supabase
        .from('news')
        .select('escalation_score')
        .not('escalation_score', 'is', null)
        .limit(1);
      
      if (escalationTest && escalationTest.length > 0) {
        console.log('✅ Escalation scoring column available and populated');
      } else {
        console.log('⚠️ Escalation scoring column exists but no scored articles found');
      }
    } catch (escalationError) {
      console.log('⚠️ Escalation scoring column not available (expected for new installations)');
    }

  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
    if (error.message.includes('JWT')) {
      console.log('   💡 Hint: You might be using ANON_KEY instead of SERVICE_KEY');
    }
    allHealthy = false;
  }

  // 3. External RSS Feeds
  console.log('\n3️⃣ Testing External RSS Feeds...');
  const testFeeds = [
    'https://www.aljazeera.com/xml/rss/all.xml',
    'http://feeds.bbci.co.uk/news/world/rss.xml',
    'https://feeds.reuters.com/reuters/worldNews',
    'https://www.defensenews.com/arc/outboundfeeds/rss/category/global/?outputType=xml',
    'https://www.militarytimes.com/arc/outboundfeeds/rss/',
    'https://www.securityaffairs.co/wordpress/feed'
  ];

  for (const feedUrl of testFeeds) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Argos-OSINT/1.0 (Health Check)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`✅ ${feedUrl} - accessible`);
      } else {
        console.log(`⚠️ ${feedUrl} - HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${feedUrl} - ${error.message}`);
      if (error.name === 'AbortError') {
        console.log('   💡 Hint: Feed is too slow, may timeout during pipeline');
      }
    }
  }

  // 4. OpenAI API (if configured)
  if (process.env.OPENAI_API_KEY) {
    console.log('\n4️⃣ Testing OpenAI API...');
    try {
      const OpenAI = await import('openai');
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 5
      });

      console.log('✅ OpenAI API accessible');
    } catch (error) {
      console.log(`❌ OpenAI API failed: ${error.message}`);
      if (error.status === 429) {
        console.log('   💡 Hint: Rate limited - pipeline may fail with high volume');
      }
    }
  } else {
    console.log('\n4️⃣ OpenAI API not configured (optional)');
  }

  // 5. GitHub Actions Environment
  if (process.env.GITHUB_ACTIONS) {
    console.log('\n5️⃣ GitHub Actions Environment Detected');
    console.log(`   Runner OS: ${process.env.RUNNER_OS || 'unknown'}`);
    console.log(`   Node Version: ${process.version}`);
    console.log(`   Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB used`);
    
    // Check available disk space
    try {
      const { execSync } = await import('child_process');
      const diskSpace = execSync('df -h / | tail -1', { encoding: 'utf8' });
      console.log(`   Disk Space: ${diskSpace.split(/\s+/)[3]} available`);
    } catch (error) {
      console.log('   Disk Space: Unable to check');
    }
  }

  // Final Result
  console.log('\n🏁 Health Check Summary:');
  if (allHealthy) {
    console.log('✅ All systems healthy - pipeline should run successfully');
    process.exit(0);
  } else {
    console.log('❌ Issues detected - pipeline may fail');
    console.log('\n💡 Recommended Actions:');
    console.log('   • Ensure SUPABASE_SERVICE_KEY is set (not ANON_KEY)');
    console.log('   • Check network connectivity');
    console.log('   • Verify API keys are valid');
    console.log('   • Test with smaller batch sizes first');
    process.exit(1);
  }
}

// Run health check
runHealthCheck().catch(error => {
  console.error('❌ Health check failed:', error.message);
  process.exit(1);
});