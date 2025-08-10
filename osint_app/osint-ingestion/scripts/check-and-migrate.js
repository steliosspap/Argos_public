#!/usr/bin/env node

/**
 * Check existing schema and migrate to V2 architecture
 * This script safely checks what exists and only creates what's missing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

class SchemaChecker {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  async checkExistingSchema() {
    console.log("🔍 Checking existing database schema...\n");

    // Check what tables exist
    const { data: tables, error } = await this.supabase
      .rpc('get_table_list'); // This might not work, see alternative below

    // Alternative: Try to select from each table
    const tableChecks = {
      'events': await this.checkTable('events'),
      'conflict_events': await this.checkTable('conflict_events'),
      'articles_raw': await this.checkTable('articles_raw'),
      'sources': await this.checkTable('sources'),
      'authors': await this.checkTable('authors'),
      'named_entities': await this.checkTable('named_entities'),
      'event_groups': await this.checkTable('event_groups')
    };

    console.log("📊 Existing tables:");
    for (const [table, exists] of Object.entries(tableChecks)) {
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }

    return tableChecks;
  }

  async checkTable(tableName) {
    try {
      const { data, error } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      return !error;
    } catch (e) {
      return false;
    }
  }

  async analyzeExistingEvents() {
    console.log("\n📈 Analyzing existing events structure...");

    // Check if we have the old 'conflict_events' table
    const hasOldTable = await this.checkTable('conflict_events');
    if (hasOldTable) {
      const { data: sample, error } = await this.supabase
        .from('conflict_events')
        .select('*')
        .limit(1)
        .single();

      if (sample) {
        console.log("\n🔍 Sample from conflict_events table:");
        console.log("Columns found:", Object.keys(sample));
        return { table: 'conflict_events', sample };
      }
    }

    // Check the 'events' table
    const hasEventsTable = await this.checkTable('events');
    if (hasEventsTable) {
      const { data: sample, error } = await this.supabase
        .from('events')
        .select('*')
        .limit(1)
        .single();

      if (sample) {
        console.log("\n🔍 Sample from events table:");
        console.log("Columns found:", Object.keys(sample));
        
        // Check if it already has article_id (indicating V2 structure)
        if (sample.article_id) {
          console.log("✅ Events table already has article_id - V2 ready!");
        } else {
          console.log("⚠️  Events table missing article_id - needs migration");
        }
        
        return { table: 'events', sample };
      }
    }

    return null;
  }

  async createMissingTables() {
    console.log("\n🛠️  Creating missing tables for V2 architecture...");

    // Run the migration SQL
    console.log("Please run the supabase-v2-migration.sql file in your Supabase SQL editor");
    console.log("The file has been created with safe CREATE IF NOT EXISTS statements");
  }

  async migrateExistingData() {
    console.log("\n🔄 Planning data migration...");

    const existing = await this.analyzeExistingEvents();
    if (!existing) {
      console.log("No existing events found to migrate");
      return;
    }

    const { count } = await this.supabase
      .from(existing.table)
      .select('*', { count: 'exact', head: true });

    console.log(`Found ${count} events in ${existing.table} table`);

    // Check if we need to create articles_raw entries
    const hasArticles = await this.checkTable('articles_raw');
    if (!hasArticles) {
      console.log("\n⚠️  articles_raw table missing - need to create it first");
      console.log("Run the migration SQL, then re-run this script");
      return;
    }

    // Create a migration plan
    console.log("\n📋 Migration plan:");
    console.log("1. Create sources entries for each unique source_name");
    console.log("2. Create articles_raw entries from event URLs");
    console.log("3. Link events to articles via article_id");
    console.log("4. Extract named entities from events");
    console.log("5. Create event groups for similar events");

    const proceed = await this.prompt("\nProceed with migration? (y/n): ");
    if (proceed.toLowerCase() !== 'y') {
      console.log("Migration cancelled");
      return;
    }

    await this.executeMigration(existing.table);
  }

  async executeMigration(sourceTable) {
    console.log("\n🚀 Starting migration...");

    // Step 1: Get all unique sources
    const { data: events } = await this.supabase
      .from(sourceTable)
      .select('source_name, source_url')
      .limit(1000);

    const uniqueSources = [...new Set(events.map(e => e.source_name).filter(Boolean))];
    console.log(`\n📰 Found ${uniqueSources.length} unique sources`);

    // Create source entries
    for (const sourceName of uniqueSources) {
      const normalized = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      
      const { error } = await this.supabase
        .from('sources')
        .upsert({
          name: sourceName,
          normalized_name: normalized,
          bias_score: 0, // Default, update later
          reliability_score: 50 // Default, update later
        }, {
          onConflict: 'normalized_name'
        });

      if (!error) {
        console.log(`  ✅ Created source: ${sourceName}`);
      }
    }

    // Step 2: Create articles from events
    console.log("\n📄 Creating articles from event URLs...");
    
    const uniqueUrls = [...new Set(events.map(e => e.source_url).filter(Boolean))];
    console.log(`Found ${uniqueUrls.length} unique URLs`);

    for (const url of uniqueUrls) {
      // Find the first event with this URL to get metadata
      const event = events.find(e => e.source_url === url);
      
      // Get source_id
      const { data: source } = await this.supabase
        .from('sources')
        .select('id')
        .eq('name', event.source_name)
        .single();

      if (source) {
        const { data: article, error } = await this.supabase
          .from('articles_raw')
          .upsert({
            url: url,
            headline: `Event from ${event.source_name}`, // We don't have headlines in old schema
            content: event.summary || 'No content available',
            published_date: event.estimated_time || event.created_at,
            source_id: source.id,
            content_hash: this.generateHash(url + (event.summary || ''))
          }, {
            onConflict: 'url'
          })
          .select()
          .single();

        if (article) {
          console.log(`  ✅ Created article for: ${url.substring(0, 50)}...`);
          
          // Update the event with article_id
          await this.supabase
            .from(sourceTable)
            .update({ article_id: article.id })
            .eq('source_url', url);
        }
      }
    }

    console.log("\n✅ Migration complete!");
    console.log("\n📊 Next steps:");
    console.log("1. Run the multi-event extractor on your articles");
    console.log("2. Set up the named entity registry");
    console.log("3. Implement the re-ingestion loop");
  }

  generateHash(content) {
    // Simple hash for demo - use crypto in production
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  async prompt(question) {
    // In a real implementation, use readline or inquirer
    console.log(question);
    return 'y'; // Auto-yes for demo
  }
}

// Run the checker
async function main() {
  console.log("🏗️  Argos V2 Schema Checker & Migrator");
  console.log("=====================================\n");

  const checker = new SchemaChecker();
  
  // Check existing schema
  await checker.checkExistingSchema();
  
  // Analyze existing events
  await checker.analyzeExistingEvents();
  
  // Create missing tables
  await checker.createMissingTables();
  
  // Migrate data if needed
  // await checker.migrateExistingData();
  
  console.log("\n✅ Check complete!");
  console.log("\n📝 To complete the migration:");
  console.log("1. Run supabase-v2-migration.sql in your Supabase SQL editor");
  console.log("2. Re-run this script with migration enabled");
  console.log("3. Test with the multi-event extractor");
}

main().catch(console.error);