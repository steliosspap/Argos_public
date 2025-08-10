#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('Checking database tables...\n');

// Tables to check
const tables = [
  'events',
  'sources', 
  'articles_raw',
  'named_entities',
  'authors',
  'conflict_events',
  'news',
  'news_sources',
  'event_groups',
  'search_queries'
];

for (const table of tables) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log(`❌ Table '${table}' does not exist`);
    } else if (error) {
      console.log(`⚠️  Table '${table}' error: ${error.message}`);
    } else {
      console.log(`✅ Table '${table}' exists`);
    }
  } catch (e) {
    console.log(`❌ Table '${table}' check failed: ${e.message}`);
  }
}

console.log('\nNote: The "sources" table might be called "news_sources" in your schema.');
console.log('You may need to run the SQL migration to create missing tables.');