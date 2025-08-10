#!/usr/bin/env node

/**
 * Verify that all required tables exist
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyTables() {
  console.log('=== VERIFYING DATABASE TABLES ===\n');
  
  const tables = [
    'news',
    'events', 
    'conflicts',
    'sources',
    'author_profiles',
    'fact_comparisons',
    'search_queries_executed',
    'conflict_events_external'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        results[table] = { exists: false, error: error.message };
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        results[table] = { exists: true, rowCount: data?.length || 0 };
        console.log(`✅ ${table}: Accessible`);
      }
    } catch (err) {
      results[table] = { exists: false, error: err.message };
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
  
  // Check sources table specifically
  console.log('\n=== CHECKING SOURCES TABLE ===');
  try {
    const { data: sources, error } = await supabase
      .from('sources')
      .select('*')
      .limit(5);
    
    if (!error) {
      console.log(`\nFound ${sources.length} sources in database:`);
      sources.forEach(source => {
        console.log(`  - ${source.outlet_name} (${source.source_type})`);
      });
    }
  } catch (err) {
    console.error('Error checking sources:', err.message);
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  const working = Object.values(results).filter(r => r.exists).length;
  const total = Object.keys(results).length;
  console.log(`${working}/${total} tables are accessible`);
  
  if (working === total) {
    console.log('\n✅ All tables verified! The enhanced ingestion pipeline can now run.');
  } else {
    console.log('\n⚠️  Some tables are missing. Check the migration status.');
  }
}

verifyTables();