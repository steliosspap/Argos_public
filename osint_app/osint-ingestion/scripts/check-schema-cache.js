#!/usr/bin/env node

/**
 * Check Supabase schema cache status
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../core/config.js';

const supabase = createClient(
  config.database.supabase.url,
  config.database.supabase.serviceKey
);

async function checkSchemaCache() {
  console.log('Checking Supabase schema cache...\n');
  
  try {
    // Test 1: Direct query to check if columns exist
    console.log('1. Direct SQL query to check columns:');
    const { data: columnCheck, error: columnError } = await supabase.rpc('get_column_info', {
      p_table_name: 'events'
    }).catch(() => ({ data: null, error: 'Function not found' }));
    
    if (columnError === 'Function not found') {
      // Create a helper function
      console.log('Creating helper function...');
      await supabase.rpc('query', {
        query: `
          CREATE OR REPLACE FUNCTION get_column_info(p_table_name text)
          RETURNS TABLE(column_name text, data_type text) AS $$
          BEGIN
            RETURN QUERY
            SELECT c.column_name::text, c.data_type::text
            FROM information_schema.columns c
            WHERE c.table_name = p_table_name AND c.table_schema = 'public'
            ORDER BY c.ordinal_position;
          END;
          $$ LANGUAGE plpgsql;
        `
      }).catch(() => {});
    }
    
    // Test 2: Try to select the columns
    console.log('\n2. Testing column access via Supabase client:');
    
    // Test sources.bias_source
    const { data: sourceTest, error: sourceError } = await supabase
      .from('sources')
      .select('id, bias_source')
      .limit(1);
    
    if (sourceError) {
      console.log('❌ sources.bias_source NOT accessible via API:', sourceError.message);
    } else {
      console.log('✅ sources.bias_source IS accessible via API');
    }
    
    // Test events.attribution_source
    const { data: eventAttrTest, error: eventAttrError } = await supabase
      .from('events')
      .select('id, attribution_source')
      .limit(1);
    
    if (eventAttrError) {
      console.log('❌ events.attribution_source NOT accessible via API:', eventAttrError.message);
    } else {
      console.log('✅ events.attribution_source IS accessible via API');
    }
    
    // Test events.casualties
    const { data: eventCasTest, error: eventCasError } = await supabase
      .from('events')
      .select('id, casualties')
      .limit(1);
    
    if (eventCasError) {
      console.log('❌ events.casualties NOT accessible via API:', eventCasError.message);
    } else {
      console.log('✅ events.casualties IS accessible via API');
    }
    
    // Test 3: Raw SQL query
    console.log('\n3. Running raw SQL query:');
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('events', 'sources')
        AND column_name IN ('bias_source', 'attribution_source', 'casualties')
      ORDER BY table_name, column_name;
    `;
    
    // Note: This requires SQL execution permissions
    console.log('Note: Direct SQL queries may require additional permissions in Supabase');
    
    console.log('\n📌 If columns exist in database but not via API:');
    console.log('1. Go to Supabase Dashboard');
    console.log('2. Navigate to Settings > API');
    console.log('3. Click "Reload schema now" button');
    console.log('4. Wait 30 seconds and try again');
    console.log('\nAlternatively, run this SQL in Supabase SQL Editor:');
    console.log("NOTIFY pgrst, 'reload schema';");
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchemaCache();