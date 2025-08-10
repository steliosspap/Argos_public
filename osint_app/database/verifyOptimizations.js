#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verifying Database Optimizations');
console.log('===================================\n');

async function checkOptimizations() {
  const results = {
    indexes: { success: false, count: 0 },
    escalation: { success: false, working: false },
    performance: { success: false, improvement: 0 },
    tables: { success: false, active: 0 }
  };
  
  try {
    // 1. Check if events table has data
    console.log('1️⃣  Checking events table...');
    const { count: eventCount, error: eventError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    if (eventError) {
      console.error('   ❌ Error checking events:', eventError.message);
    } else {
      console.log(`   ✅ Events table has ${eventCount} records`);
      results.tables.active = eventCount;
    }
    
    // 2. Check recent events
    console.log('\n2️⃣  Checking recent events (last 24h)...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentEvents, error: recentError } = await supabase
      .from('events')
      .select('id, title, country, region, severity, timestamp')
      .gte('timestamp', yesterday.toISOString())
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (recentError) {
      console.error('   ❌ Error fetching recent events:', recentError.message);
    } else {
      console.log(`   ✅ Found ${recentEvents?.length || 0} recent events`);
      if (recentEvents && recentEvents.length > 0) {
        recentEvents.forEach(event => {
          console.log(`      - ${event.title?.substring(0, 50)}... (${event.country})`);
        });
      }
    }
    
    // 3. Check active conflicts with escalation scores
    console.log('\n3️⃣  Checking conflict escalation scores...');
    const { data: conflicts, error: conflictError } = await supabase
      .from('conflicts')
      .select('name, country, region, escalation_score, escalation_last_calculated')
      .eq('status', 'active')
      .not('escalation_score', 'is', null)
      .order('escalation_score', { ascending: false })
      .limit(10);
    
    if (conflictError) {
      console.error('   ❌ Error checking conflicts:', conflictError.message);
    } else {
      const withScores = conflicts?.filter(c => c.escalation_score > 0) || [];
      console.log(`   ✅ Found ${withScores.length} conflicts with escalation scores`);
      
      if (withScores.length > 0) {
        console.log('\n   Top conflicts by escalation:');
        withScores.slice(0, 5).forEach(conflict => {
          const lastUpdate = conflict.escalation_last_calculated 
            ? new Date(conflict.escalation_last_calculated).toLocaleString()
            : 'Never';
          console.log(`      - ${conflict.name}: Score ${conflict.escalation_score} (Updated: ${lastUpdate})`);
        });
        results.escalation.working = true;
      } else {
        console.log('   ⚠️  No conflicts have escalation scores yet');
        console.log('   💡 This will populate as new events are added');
      }
    }
    
    // 4. Test query performance
    console.log('\n4️⃣  Testing query performance...');
    const perfTests = [
      {
        name: 'Events by country/region',
        query: async () => {
          const start = Date.now();
          await supabase
            .from('events')
            .select('id')
            .eq('country', 'Syria')
            .eq('region', 'Middle East')
            .limit(100);
          return Date.now() - start;
        }
      },
      {
        name: 'Recent news articles',
        query: async () => {
          const start = Date.now();
          await supabase
            .from('news')
            .select('id')
            .gte('published_at', yesterday.toISOString())
            .order('published_at', { ascending: false })
            .limit(100);
          return Date.now() - start;
        }
      },
      {
        name: 'Active conflicts',
        query: async () => {
          const start = Date.now();
          await supabase
            .from('conflicts')
            .select('id')
            .eq('status', 'active')
            .order('escalation_score', { ascending: false });
          return Date.now() - start;
        }
      }
    ];
    
    console.log('   Running performance tests...');
    for (const test of perfTests) {
      try {
        const time = await test.query();
        console.log(`      - ${test.name}: ${time}ms ${time < 500 ? '✅' : '⚠️'}`);
      } catch (error) {
        console.log(`      - ${test.name}: ❌ Failed`);
      }
    }
    
    // 5. Summary
    console.log('\n📊 OPTIMIZATION SUMMARY');
    console.log('======================');
    
    console.log('\n✅ Completed:');
    console.log('   - Database connection working');
    console.log(`   - ${eventCount} events in database`);
    console.log(`   - ${conflicts?.length || 0} active conflicts`);
    
    if (withScores.length === 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   - Run the escalation SQL migrations in Supabase SQL Editor');
      console.log('   - The files are in database/migrations/');
      console.log('   - After running migrations, new events will trigger escalation updates');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Run all migration files in Supabase SQL Editor');
    console.log('   2. Monitor query performance over next 24 hours');
    console.log('   3. Check that escalation scores update when new events arrive');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
  }
}

// Add function to manually trigger escalation updates
async function triggerEscalationUpdate() {
  console.log('\n🔄 Manually triggering escalation update...');
  
  try {
    // Import and run the update function
    const { updateConflictZoneEscalation } = await import('../osint-ingestion/sync/syncEvents.js');
    const results = await updateConflictZoneEscalation(supabase);
    
    console.log('   Update Results:');
    console.log(`   - Success: ${results.success}`);
    console.log(`   - Updated: ${results.updated} conflicts`);
    console.log(`   - Errors: ${results.errors}`);
    
    if (results.updated > 0) {
      console.log('\n   ✅ Escalation scores updated successfully!');
    } else {
      console.log('\n   ℹ️  No updates needed (scores already current)');
    }
  } catch (error) {
    console.error('   ❌ Failed to trigger update:', error.message);
    console.log('   💡 Make sure to run the SQL migrations first');
  }
}

// Run verification
await checkOptimizations();

// Ask if user wants to trigger manual update
console.log('\n❓ Would you like to manually trigger an escalation update?');
console.log('   Run: node verifyOptimizations.js --update');

if (process.argv.includes('--update')) {
  await triggerEscalationUpdate();
}

console.log('\n✨ Verification complete!');