#!/usr/bin/env node

/**
 * Setup script for pgvector in the database
 * This enables vector similarity search for deduplication
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setupPgVector() {
  console.log('🚀 Setting up pgvector for enhanced ML capabilities...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../osint-ingestion/sql/add-embedding.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf-8');

    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Show a preview of the statement
      const preview = statement.substring(0, 50).replace(/\n/g, ' ');
      console.log(`  ${preview}...`);

      try {
        // Execute via Supabase's SQL function
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement
        });

        if (error) {
          console.error(`  ❌ Error: ${error.message}`);
          
          // If it's just about extension already existing, that's OK
          if (error.message.includes('already exists')) {
            console.log('  ⚠️  Already exists, continuing...');
          } else {
            throw error;
          }
        } else {
          console.log('  ✅ Success');
        }
      } catch (err) {
        console.error(`  ❌ Failed to execute: ${err.message}`);
      }
    }

    console.log('\n✨ pgvector setup complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Set environment variables:');
    console.log('   ENABLE_VECTOR_SIMILARITY=true');
    console.log('   ENABLE_CLUSTERING=true');
    console.log('   ENABLE_TRANSLATION=true');
    console.log('\n2. Install Python dependencies:');
    console.log('   cd osint-ingestion && pip install -r requirements.txt');
    console.log('\n3. Run the vector worker to generate embeddings:');
    console.log('   python osint-ingestion/scripts/vector_worker.py');
    console.log('\n4. Use the enhanced ingestion endpoint:');
    console.log('   /api/ingest-enhanced');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Check if we have required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Run setup
setupPgVector();