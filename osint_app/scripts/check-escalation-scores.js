#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEscalationScores() {
  console.log('🔍 Checking escalation scores in database...\n');

  try {
    // Get events from conflict zones
    const { data: events } = await supabase
      .from('events')
      .select('country, severity, escalation_score, title')
      .in('country', ['Ukraine', 'Israel', 'Palestine', 'Syria', 'Russia', 'Gaza', 'West Bank'])
      .order('timestamp', { ascending: false })
      .limit(200);

    // Group by country
    const byCountry = {};
    events?.forEach(event => {
      const country = event.country || 'Unknown';
      if (!byCountry[country]) {
        byCountry[country] = { 
          scores: [], 
          severities: {},
          titles: []
        };
      }
      byCountry[country].scores.push(event.escalation_score || 0);
      byCountry[country].severities[event.severity || 'unknown'] = 
        (byCountry[country].severities[event.severity || 'unknown'] || 0) + 1;
      if (byCountry[country].titles.length < 3) {
        byCountry[country].titles.push(event.title?.substring(0, 60) + '...');
      }
    });

    console.log('📊 Escalation scores by country:\n');
    Object.entries(byCountry).forEach(([country, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const nonZero = data.scores.filter(s => s > 0);
      
      console.log(`${country}:`);
      console.log(`  Total events analyzed: ${data.scores.length}`);
      console.log(`  Average escalation_score: ${avg.toFixed(2)}`);
      console.log(`  Non-zero scores: ${nonZero.length} (${(nonZero.length / data.scores.length * 100).toFixed(1)}%)`);
      console.log(`  Severity distribution:`, data.severities);
      console.log(`  Sample scores:`, data.scores.slice(0, 10));
      console.log(`  Sample events:`);
      data.titles.forEach(title => console.log(`    - ${title}`));
      console.log('');
    });

    // Check if escalation_score column exists and has values
    const { data: allScores } = await supabase
      .from('events')
      .select('escalation_score')
      .not('escalation_score', 'is', null)
      .limit(10);

    console.log(`\n📈 Events with non-null escalation_score: ${allScores?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkEscalationScores().then(() => {
  console.log('✅ Check complete');
  process.exit(0);
});