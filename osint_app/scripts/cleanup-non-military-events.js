#!/usr/bin/env node

/**
 * Script to clean up non-military/conflict events from the database
 * This will remove events that were incorrectly ingested (sports, entertainment, etc.)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { conflictDetector } from '../osint-ingestion/conflictDetection.js';

// Load environment
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Non-military patterns to check
const nonMilitaryPatterns = [
  // Sports
  'cricket', 'football', 'hockey', 'tennis', 'badminton', 'sports',
  'match', 'tournament', 'league', 'championship', 'olympics',
  
  // Entertainment
  'bollywood', 'movie', 'film', 'actor', 'actress', 'music',
  
  // Economy/Business (unless sanctions/arms related)
  'stock market', 'gdp', 'inflation', 'quarterly results', 'ipo',
  'startup', 'unicorn', 'funding round',
  
  // Health/Medical (unless war casualties)
  'covid', 'vaccine', 'heart attack', 'stroke',
  
  // Technology (unless military tech)
  'app launch', 'smartphone', 'social media',
  
  // Natural disasters (unless conflict-related)
  'earthquake', 'cyclone', 'monsoon', 'flood',
  
  // Animals (dog attacks, etc.)
  'dog attack', 'animal attack', 'snake bite', 'tiger',
];

async function cleanupEvents() {
  console.log('Starting cleanup of non-military events...');
  
  try {
    // Fetch all events
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, summary, country')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching events:', error);
      return;
    }
    
    console.log(`Found ${events.length} total events to analyze`);
    
    const toDelete = [];
    const stats = {
      sports: 0,
      entertainment: 0,
      business: 0,
      health: 0,
      natural: 0,
      animal: 0,
      other: 0
    };
    
    // Analyze each event
    for (const event of events) {
      const text = `${event.title} ${event.summary}`.toLowerCase();
      
      // Use conflict detector
      const analysis = conflictDetector.analyzeConflict(text, event.country, null);
      
      if (analysis.type === 'non-military' || analysis.isNonMilitary) {
        toDelete.push(event.id);
        
        // Categorize for stats
        if (text.includes('cricket') || text.includes('football') || text.includes('sports')) {
          stats.sports++;
        } else if (text.includes('bollywood') || text.includes('movie') || text.includes('actor')) {
          stats.entertainment++;
        } else if (text.includes('stock') || text.includes('gdp') || text.includes('economy')) {
          stats.business++;
        } else if (text.includes('covid') || text.includes('vaccine') || text.includes('heart attack')) {
          stats.health++;
        } else if (text.includes('earthquake') || text.includes('cyclone') || text.includes('flood')) {
          stats.natural++;
        } else if (text.includes('dog attack') || text.includes('animal')) {
          stats.animal++;
        } else {
          stats.other++;
        }
        
        console.log(`Non-military: ${event.country} - ${event.title}`);
      }
    }
    
    console.log('\nCleanup Summary:');
    console.log(`Total events: ${events.length}`);
    console.log(`To delete: ${toDelete.length}`);
    console.log('\nBreakdown:');
    console.log(`- Sports: ${stats.sports}`);
    console.log(`- Entertainment: ${stats.entertainment}`);
    console.log(`- Business: ${stats.business}`);
    console.log(`- Health: ${stats.health}`);
    console.log(`- Natural disasters: ${stats.natural}`);
    console.log(`- Animal incidents: ${stats.animal}`);
    console.log(`- Other: ${stats.other}`);
    
    if (toDelete.length > 0) {
      console.log('\nProceed with deletion? (y/n)');
      
      process.stdin.once('data', async (data) => {
        const answer = data.toString().trim().toLowerCase();
        
        if (answer === 'y') {
          console.log('Deleting non-military events...');
          
          // Delete in batches
          const batchSize = 100;
          for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = toDelete.slice(i, i + batchSize);
            
            const { error: deleteError } = await supabase
              .from('events')
              .delete()
              .in('id', batch);
            
            if (deleteError) {
              console.error('Error deleting batch:', deleteError);
            } else {
              console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toDelete.length / batchSize)}`);
            }
          }
          
          console.log('Cleanup completed!');
        } else {
          console.log('Cleanup cancelled.');
        }
        
        process.exit(0);
      });
    } else {
      console.log('\nNo non-military events found. Database is clean!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupEvents();