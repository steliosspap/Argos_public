#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('🔧 Applying enhanced columns migration...\n');
  
  try {
    // Add discovery_round column
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.events 
        ADD COLUMN IF NOT EXISTS discovery_round INTEGER DEFAULT 1;
      `
    });
    
    if (error1) {
      console.log('Note: discovery_round column may already exist or exec_sql not available');
    } else {
      console.log('✅ Added discovery_round column');
    }
    
    // Add source_reliability column
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.events 
        ADD COLUMN IF NOT EXISTS source_reliability DECIMAL(3,2) DEFAULT 0.60;
      `
    });
    
    if (error2) {
      console.log('Note: source_reliability column may already exist');
    } else {
      console.log('✅ Added source_reliability column');
    }
    
    // Try a different approach - insert a test event with the new columns
    console.log('\n🧪 Testing enhanced columns...');
    
    const testEvent = {
      title: 'Test Event for Enhanced Columns',
      summary: 'Testing discovery_round and source_reliability',
      timestamp: new Date().toISOString(),
      country: 'Test Country',
      severity: 'low',
      event_type: 'test',
      source_url: 'https://test.com/test-' + Date.now(),
      content_hash: 'test-hash-' + Date.now(),
      discovery_round: 2,
      source_reliability: 0.95
    };
    
    const { data, error } = await supabase
      .from('events')
      .insert(testEvent)
      .select();
    
    if (error) {
      console.error('❌ Error inserting test event:', error);
      console.log('\n⚠️  The enhanced columns may not exist yet.');
      console.log('Please add these columns manually in Supabase dashboard:');
      console.log('1. discovery_round (integer, default: 1)');
      console.log('2. source_reliability (numeric(3,2), default: 0.60)');
    } else {
      console.log('✅ Successfully inserted test event with enhanced columns!');
      
      // Clean up test event
      if (data && data[0]) {
        await supabase
          .from('events')
          .delete()
          .eq('id', data[0].id);
        console.log('🧹 Cleaned up test event');
      }
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

applyMigration();