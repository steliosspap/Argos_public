#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '../../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('=== CHECKING SUPABASE SCHEMA ===\n');
  
  // Get all tables
  const { data: tables, error: tablesError } = await supabase
    .from('conflict_events')
    .select('*')
    .limit(0);
  
  console.log('Available tables and columns:');
  
  // Check conflict_events structure by trying to insert empty object
  const { error: schemaError } = await supabase
    .from('conflict_events')
    .insert([{}])
    .select();
  
  if (schemaError) {
    console.log('\nconflict_events schema error:', schemaError.message);
    console.log('Details:', schemaError.details);
    console.log('Hint:', schemaError.hint);
  }
  
  // Try to fetch one record to see actual structure
  const { data: sampleData, error: sampleError } = await supabase
    .from('conflict_events')
    .select('*')
    .limit(1);
  
  if (!sampleError && sampleData && sampleData.length > 0) {
    console.log('\nSample conflict_events record structure:');
    console.log(Object.keys(sampleData[0]));
  }
  
  // List all tables in the database
  const { data: allTables, error: allTablesError } = await supabase
    .rpc('get_tables', {});
  
  if (!allTablesError && allTables) {
    console.log('\nAll available tables:', allTables);
  }
}

checkSchema();