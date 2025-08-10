#!/usr/bin/env node

/**
 * Script to enhance existing headlines in the database
 * This will update vague headlines with more informative ones
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables BEFORE importing headlineEnhancer
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

// Now import after env is loaded
import { enhanceHeadline } from '../osint-ingestion/utils/headlineEnhancer.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function enhanceExistingHeadlines(options = {}) {
  const { limit = 100, dryRun = false, onlyVague = true } = options;
  
  console.log('Starting headline enhancement process...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  
  try {
    // Fetch events that might need enhancement
    let query = supabase
      .from('events')
      .select('id, title, summary, country, region, event_classifier, event_type')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // If only processing vague headlines, filter them
    if (onlyVague) {
      // For now, fetch all and filter in JavaScript since complex NOT queries are tricky in PostgREST
      // We'll filter after fetching
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      console.error('Error fetching events:', error);
      return;
    }
    
    // Filter events if onlyVague is true
    let eventsToProcess = events;
    if (onlyVague) {
      eventsToProcess = events.filter(event => isHeadlineVague(event.title));
      console.log(`Found ${events.length} events, ${eventsToProcess.length} have vague headlines`);
    } else {
      console.log(`Found ${events.length} events to process`);
    }
    
    let enhanced = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const event of eventsToProcess) {
      try {
        console.log(`\nProcessing: "${event.title}"`);
        
        // Enhance the headline
        const enhancedTitle = await enhanceHeadline({
          originalTitle: event.title,
          content: event.summary,
          metadata: {
            location: `${event.country || ''} ${event.region || ''}`.trim(),
            actors: event.event_classifier || [],
            eventType: event.event_type
          }
        });
        
        if (enhancedTitle !== event.title) {
          console.log(`Enhanced to: "${enhancedTitle}"`);
          
          if (!dryRun) {
            // Update the event with enhanced headline
            const { error: updateError } = await supabase
              .from('events')
              .update({ 
                title: enhancedTitle,
                // Add a tag to track that this was enhanced
                event_classifier: [...(event.event_classifier || []), 'headline_enhanced']
              })
              .eq('id', event.id);
            
            if (updateError) {
              console.error(`Failed to update event ${event.id}:`, updateError);
              failed++;
            } else {
              enhanced++;
            }
          } else {
            enhanced++;
          }
        } else {
          console.log('No enhancement needed');
          skipped++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error.message);
        failed++;
      }
    }
    
    console.log('\n=== Enhancement Complete ===');
    console.log(`Enhanced: ${enhanced}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total processed: ${events.length}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

function isHeadlineVague(headline) {
  const vaguePatterns = [
    /update/i,
    /situation/i,
    /tensions/i,
    /developments/i,
    /latest/i,
    /reports/i,
    /news/i,
    /^breaking:/i
  ];
  
  // Check if headline contains vague patterns
  const hasVaguePattern = vaguePatterns.some(pattern => pattern.test(headline));
  
  // Check if headline lacks action verbs
  const actionVerbs = [
    'strikes', 'kills', 'attacks', 'launches', 'fires', 'bombs', 
    'raids', 'captures', 'destroys', 'shoots', 'intercepts', 'targets'
  ];
  const hasActionVerb = actionVerbs.some(verb => 
    headline.toLowerCase().includes(verb)
  );
  
  // Check if headline lacks numbers
  const hasNumbers = /\d+/.test(headline);
  
  return hasVaguePattern || (!hasActionVerb && !hasNumbers);
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    limit: 100,
    dryRun: args.includes('--dry-run'),
    onlyVague: !args.includes('--all')
  };
  
  // Parse limit if provided
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1], 10);
  }
  
  console.log('Usage: node enhance-existing-headlines.js [options]');
  console.log('Options:');
  console.log('  --dry-run    Preview changes without updating database');
  console.log('  --limit N    Process only N events (default: 100)');
  console.log('  --all        Process all headlines, not just vague ones');
  console.log('');
  
  enhanceExistingHeadlines(options);
}

export default enhanceExistingHeadlines;