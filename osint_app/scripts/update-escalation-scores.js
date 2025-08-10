#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { computeEscalationScore } from '../osint-ingestion/nlp/computeEscalationScore.js';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateEscalationScores() {
  console.log('🚀 Starting escalation score update...');
  
  try {
    // Fetch all events, especially focusing on recent ones
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, summary, country, region, timestamp, escalation_score')
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    console.log(`📊 Found ${events.length} events to process`);
    
    let updated = 0;
    let iranIsraelCount = 0;
    
    for (const event of events) {
      // Compute new escalation score
      const escalationResult = computeEscalationScore({
        title: event.title,
        summary: event.summary,
        description: event.summary
      });
      
      const newScore = escalationResult.score;
      const oldScore = event.escalation_score || 1;
      
      // Check if this is Iran-Israel related
      const isIranIsrael = /\b(iran|israel|hezbollah|hamas|revolutionary.*guard)\b/i.test(
        `${event.title} ${event.summary}`
      );
      
      if (isIranIsrael) {
        iranIsraelCount++;
      }
      
      // Update if score changed significantly (more than 0.5 difference)
      if (Math.abs(newScore - oldScore) > 0.5) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ escalation_score: newScore })
          .eq('id', event.id);
        
        if (updateError) {
          console.error(`❌ Error updating event ${event.id}:`, updateError);
        } else {
          updated++;
          if (isIranIsrael) {
            console.log(`🎯 Updated Iran/Israel event: "${event.title.slice(0, 50)}..." from ${oldScore} to ${newScore}`);
          }
        }
      }
    }
    
    console.log(`✅ Update complete!`);
    console.log(`📈 Updated ${updated} out of ${events.length} events`);
    console.log(`🇮🇱🇮🇷 Found ${iranIsraelCount} Iran/Israel related events`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the update
updateEscalationScores();