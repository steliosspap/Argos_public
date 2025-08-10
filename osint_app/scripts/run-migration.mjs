/**
 * Run the has_analysis migration
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔧 Running migration to add has_analysis column...\n');

// Read the migration file
const migrationPath = join(__dirname, '../database/migrations/add_has_analysis_column.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

// Split into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

// Execute each statement
for (const statement of statements) {
  console.log(`Executing: ${statement.substring(0, 50)}...`);
  
  const { error } = await supabase.rpc('execute_sql', {
    query: statement + ';'
  }).single();
  
  if (error) {
    // Try direct execution if RPC doesn't work
    console.log('RPC failed, trying alternative method...');
    // Note: Supabase client doesn't support raw SQL, so we'll check what we can do
  }
}

// Verify the columns exist
const { data: newsColumns } = await supabase
  .from('news')
  .select('*')
  .limit(1);

const { data: eventsColumns } = await supabase
  .from('events')
  .select('*')
  .limit(1);

if (newsColumns && newsColumns.length > 0) {
  console.log('\n📰 News table columns:', Object.keys(newsColumns[0]));
}

if (eventsColumns && eventsColumns.length > 0) {
  console.log('\n🎯 Events table columns:', Object.keys(eventsColumns[0]));
}

console.log('\n✨ Please run this migration directly in your Supabase dashboard SQL editor.');
console.log('📋 Migration file: database/migrations/add_has_analysis_column.sql');