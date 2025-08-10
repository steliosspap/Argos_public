#!/usr/bin/env node

/**
 * Test script to verify database fixes
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../core/config.js';

const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceKey
);

async function testDatabaseConnection() {
  console.log('Testing database connection and schema...\n');
  
  try {
    // Test 1: Check if sources table exists and has correct columns
    console.log('1. Testing sources table...');
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .limit(1);
    
    if (sourcesError) {
      console.error('❌ Sources table error:', sourcesError);
    } else {
      console.log('✅ Sources table accessible');
      
      // Try to insert a test source
      const testSource = {
        name: 'Test Source',
        normalized_name: 'test_source_' + Date.now(),
        website: 'https://test.com',
        bias_score: 0,
        reliability_score: 50,
        bias_source: 'manual'
      };
      
      const { error: insertError } = await supabase
        .from('sources')
        .insert(testSource);
      
      if (insertError) {
        console.error('❌ Insert test failed:', insertError);
      } else {
        console.log('✅ Successfully inserted test source');
        
        // Clean up
        await supabase
          .from('sources')
          .delete()
          .eq('normalized_name', testSource.normalized_name);
      }
    }
    
    // Test 2: Check if events table has attribution_source column
    console.log('\n2. Testing events table columns...');
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, attribution_source')
      .limit(1);
    
    if (eventsError) {
      console.error('❌ Events table error:', eventsError);
    } else {
      console.log('✅ Events table has attribution_source column');
    }
    
    // Test 3: Check if articles_raw table exists
    console.log('\n3. Testing articles_raw table...');
    const { data: articles, error: articlesError } = await supabase
      .from('articles_raw')
      .select('*')
      .limit(1);
    
    if (articlesError) {
      console.error('❌ Articles_raw table error:', articlesError);
    } else {
      console.log('✅ Articles_raw table accessible');
    }
    
    console.log('\n✅ All database tests completed!');
    console.log('\nNext steps:');
    console.log('1. Run the SQL migration script in Supabase SQL Editor:');
    console.log('   osint_app/osint-ingestion/sql/fix-database-schema.sql');
    console.log('2. Then run the ingestion pipeline again:');
    console.log('   ./cli.js ingest --verbose --limit 5');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  process.exit(0);
}

testDatabaseConnection();