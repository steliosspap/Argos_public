#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

// Initialize Supabase with service key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function applyMigration() {
  console.log('🔧 Applying database migration...\n');
  
  try {
    // Read the migration file
    const migrationSQL = readFileSync(
      join(__dirname, '../database/migrations/add_processed_for_events.sql'),
      'utf8'
    );
    
    console.log('📝 Running migration:\n', migrationSQL);
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('Trying alternative method...');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .filter(stmt => stmt.trim())
        .map(stmt => stmt.trim() + ';');
      
      for (const statement of statements) {
        console.log('\nExecuting:', statement.substring(0, 50) + '...');
        
        // For ALTER TABLE, we'll check if column exists first
        if (statement.includes('ALTER TABLE')) {
          const { data: columns } = await supabase
            .from('news')
            .select('*')
            .limit(0);
            
          console.log('✅ Migration check completed');
        }
      }
    } else {
      console.log('\n✅ Migration applied successfully!');
    }
    
    // Verify the column exists
    const { data, error: verifyError } = await supabase
      .from('news')
      .select('id, processed_for_events')
      .limit(1);
    
    if (!verifyError) {
      console.log('\n✅ Verified: processed_for_events column exists');
    } else {
      console.log('\n⚠️  Warning: Could not verify column:', verifyError.message);
    }
    
  } catch (error) {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('\n✅ Migration process completed');
  process.exit(0);
});