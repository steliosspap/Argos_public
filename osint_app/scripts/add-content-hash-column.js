#!/usr/bin/env node

/**
 * Script to add content_hash column to events table
 * This enables duplicate prevention for news ingestion
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addContentHashColumn() {
  try {
    console.log('Adding content_hash column to events table...');
    
    // Add the column if it doesn't exist
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'content_hash'
          ) THEN
            ALTER TABLE events ADD COLUMN content_hash TEXT;
          END IF;
        END $$;
      `
    });
    
    if (addColumnError) {
      console.error('Error adding column:', addColumnError);
      // Try direct approach if RPC doesn't work
      console.log('Trying alternative approach...');
      
      // This will fail if column already exists, which is fine
      const { error: altError } = await supabase
        .from('events')
        .select('content_hash')
        .limit(1);
        
      if (altError && altError.message.includes('column')) {
        console.log('Column does not exist, please add it manually in Supabase dashboard:');
        console.log('ALTER TABLE events ADD COLUMN content_hash TEXT;');
        console.log('CREATE UNIQUE INDEX idx_events_content_hash ON events(content_hash);');
        return;
      }
    }
    
    console.log('✓ content_hash column added successfully (or already exists)');
    
    // Create unique index
    console.log('Creating unique index on content_hash...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'events' AND indexname = 'idx_events_content_hash'
          ) THEN
            CREATE UNIQUE INDEX idx_events_content_hash ON events(content_hash);
          END IF;
        END $$;
      `
    });
    
    if (indexError) {
      console.log('Could not create index via RPC. Please create it manually:');
      console.log('CREATE UNIQUE INDEX idx_events_content_hash ON events(content_hash);');
    } else {
      console.log('✓ Unique index created successfully');
    }
    
    // Also add to news table
    console.log('\nAdding content_hash to news table...');
    const { error: newsColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'news' AND column_name = 'content_hash'
          ) THEN
            ALTER TABLE news ADD COLUMN content_hash TEXT;
            CREATE UNIQUE INDEX idx_news_content_hash ON news(content_hash);
          END IF;
        END $$;
      `
    });
    
    if (newsColumnError) {
      console.log('Please also add content_hash to news table:');
      console.log('ALTER TABLE news ADD COLUMN content_hash TEXT;');
      console.log('CREATE UNIQUE INDEX idx_news_content_hash ON news(content_hash);');
    } else {
      console.log('✓ news table updated successfully');
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.log('\nPlease add the following columns manually in your Supabase dashboard:');
    console.log('\nFor events table:');
    console.log('ALTER TABLE events ADD COLUMN content_hash TEXT;');
    console.log('CREATE UNIQUE INDEX idx_events_content_hash ON events(content_hash);');
    console.log('\nFor news table:');
    console.log('ALTER TABLE news ADD COLUMN content_hash TEXT;');
    console.log('CREATE UNIQUE INDEX idx_news_content_hash ON news(content_hash);');
  }
}

// Run the script
addContentHashColumn();