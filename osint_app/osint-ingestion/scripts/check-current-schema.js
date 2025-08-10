#!/usr/bin/env node

/**
 * Check the actual structure of your existing tables
 * This will help us understand what columns you have
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

async function checkSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log("🔍 Checking your current database schema...\n");

  // Try to get a sample from events table
  console.log("📊 Checking 'events' table:");
  try {
    const { data: eventSample, error: eventError } = await supabase
      .from('events')
      .select('*')
      .limit(1)
      .single();

    if (eventError) {
      console.log("❌ Error accessing events table:", eventError.message);
    } else if (eventSample) {
      console.log("✅ Found events table with columns:");
      Object.keys(eventSample).forEach(col => {
        const value = eventSample[col];
        const type = value === null ? 'null' : typeof value;
        console.log(`   - ${col}: ${type} (sample: ${JSON.stringify(value).substring(0, 50)}...)`);
      });
      
      console.log("\n📝 Total columns:", Object.keys(eventSample).length);
    }
  } catch (e) {
    console.log("❌ Events table not found or error:", e.message);
  }

  // Check for conflict_events table
  console.log("\n📊 Checking 'conflict_events' table:");
  try {
    const { data: conflictSample, error: conflictError } = await supabase
      .from('conflict_events')
      .select('*')
      .limit(1)
      .single();

    if (conflictError) {
      console.log("❌ No conflict_events table found (this is fine)");
    } else if (conflictSample) {
      console.log("✅ Found conflict_events table with columns:");
      Object.keys(conflictSample).forEach(col => {
        console.log(`   - ${col}`);
      });
    }
  } catch (e) {
    console.log("❌ Conflict_events table not found");
  }

  // Check for event_groups table
  console.log("\n📊 Checking 'event_groups' table:");
  try {
    const { data: groupSample, error: groupError } = await supabase
      .from('event_groups')
      .select('*')
      .limit(1)
      .single();

    if (groupError) {
      console.log("❌ No event_groups table found");
    } else if (groupSample) {
      console.log("✅ Found event_groups table");
    }
  } catch (e) {
    console.log("❌ Event_groups table not found");
  }

  // Check for articles tables
  console.log("\n📊 Checking for article-related tables:");
  const articleTables = ['articles', 'articles_raw', 'raw_articles'];
  
  for (const tableName of articleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`✅ Found table: ${tableName}`);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }

  // Get event count
  console.log("\n📈 Database statistics:");
  try {
    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total events: ${eventCount || 0}`);
  } catch (e) {
    console.log("   Could not count events");
  }

  // Provide recommendations
  console.log("\n💡 Recommendations based on your schema:");
  console.log("\n1. Your 'events' table exists but may have different column names");
  console.log("2. We need to create a mapping between your columns and the V2 schema");
  console.log("3. The main goal is to support multiple events per article");
  
  console.log("\n📝 Next steps:");
  console.log("1. Share the column names from your events table above");
  console.log("2. I'll create a custom migration that works with your exact schema");
  console.log("3. We'll add the multi-event extraction capability without breaking your existing data");
}

checkSchema().catch(console.error);