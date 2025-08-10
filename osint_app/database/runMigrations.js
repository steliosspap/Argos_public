#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY are set');
  process.exit(1);
}

console.log('🚀 Argos Database Optimization Script');
console.log('=====================================\n');

async function runMigration(migrationFile, description) {
  console.log(`\n📋 ${description}`);
  console.log('-'.repeat(50));
  
  try {
    const sql = readFileSync(path.join(__dirname, 'migrations', migrationFile), 'utf8');
    
    // Note: Supabase JS client doesn't support raw SQL execution
    // We need to use the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

// Since Supabase JS doesn't support raw SQL, let's create instructions instead
console.log('📝 INSTRUCTIONS FOR DATABASE OPTIMIZATION');
console.log('========================================\n');

console.log('Since Supabase JS client doesn\'t support raw SQL execution,');
console.log('please follow these steps to optimize your database:\n');

console.log('1️⃣  Open Supabase Dashboard: https://app.supabase.com');
console.log('2️⃣  Navigate to your project');
console.log('3️⃣  Go to SQL Editor (in the left sidebar)');
console.log('4️⃣  Run each migration file in order:\n');

const migrations = [
  {
    file: '001_add_performance_indexes.sql',
    description: 'Add missing indexes for 40-60% performance boost',
    impact: 'Immediate query speed improvements'
  },
  {
    file: '002_archive_unused_tables.sql',
    description: 'Archive unused analytics tables to save storage',
    impact: '~30% storage reduction'
  },
  {
    file: '003_fix_escalation_pipeline.sql',
    description: 'Fix automatic escalation score updates',
    impact: 'Conflicts will update automatically when events are added'
  }
];

migrations.forEach((migration, index) => {
  console.log(`Step ${index + 1}: ${migration.description}`);
  console.log(`   📄 File: database/migrations/${migration.file}`);
  console.log(`   💡 Impact: ${migration.impact}`);
  console.log(`   ⏱️  Estimated time: 1-2 minutes\n`);
});

console.log('5️⃣  After running all migrations, verify the results\n');

console.log('🔍 VERIFICATION QUERIES:');
console.log('=======================\n');

console.log('-- Check new indexes:');
console.log(`SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename;\n`);

console.log('-- Check archived tables:');
console.log(`SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'archive';\n`);

console.log('-- Check escalation updates:');
console.log(`SELECT name, escalation_score, escalation_last_calculated 
FROM conflicts 
WHERE status = 'active' 
ORDER BY escalation_score DESC;\n`);

console.log('📊 EXPECTED RESULTS:');
console.log('===================');
console.log('✅ 10+ new indexes created');
console.log('✅ 9-11 tables moved to archive schema');
console.log('✅ Active conflicts showing updated escalation scores');
console.log('✅ Faster query performance on events and news tables\n');

console.log('⚠️  IMPORTANT NOTES:');
console.log('===================');
console.log('1. Indexes are created with CONCURRENTLY - no table locks');
console.log('2. Archived tables can be restored with: ALTER TABLE archive.table_name SET SCHEMA public;');
console.log('3. The escalation trigger will run automatically going forward');
console.log('4. Monitor your application for any issues\n');

console.log('💬 If you encounter any issues, check:');
console.log('   - Supabase logs in the dashboard');
console.log('   - Application error logs');
console.log('   - Database performance metrics\n');

// Create a simple test to verify connection
console.log('🔌 Testing database connection...');
const supabase = createClient(supabaseUrl, supabaseKey);

try {
  const { count, error } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  
  console.log(`✅ Connected successfully! Found ${count} events in database.\n`);
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  console.error('   Please check your credentials and try again.\n');
}

console.log('📚 Migration files are located at:');
console.log(`   ${path.join(__dirname, 'migrations')}\n`);
console.log('Good luck with your optimization! 🚀');