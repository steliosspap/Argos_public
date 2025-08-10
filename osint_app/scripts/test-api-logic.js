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

// Copy the deduplication logic from the API
function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function areEventsSimilar(event1, event2) {
  if (event1.id === event2.id) return true;
  
  const timeDiff = Math.abs(new Date(event1.timestamp).getTime() - new Date(event2.timestamp).getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (hoursDiff > 2) return false;
  
  const sameLocation = (
    (event1.country === event2.country && event1.region === event2.region) ||
    (Math.abs(event1.latitude - event2.latitude) < 0.1 && Math.abs(event1.longitude - event2.longitude) < 0.1)
  );
  
  if (sameLocation) {
    const titleSimilarity = calculateSimilarity(
      event1.title || event1.summary || '', 
      event2.title || event2.summary || ''
    );
    
    return titleSimilarity > 0.7;
  }
  
  return false;
}

function deduplicateEvents(events) {
  const deduplicated = [];
  const locationCounts = {};
  
  const sorted = [...events].sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    if (severityDiff !== 0) return severityDiff;
    
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  for (const event of sorted) {
    const locationKey = `${event.country || 'unknown'}_${event.region || 'unknown'}`;
    const locationCount = locationCounts[locationKey] || 0;
    
    let isDuplicate = false;
    
    if (locationCount < 5) {
      for (let i = 0; i < deduplicated.length; i++) {
        if (event.id === deduplicated[i].id) {
          isDuplicate = true;
          break;
        }
      }
    } else {
      for (let i = 0; i < deduplicated.length; i++) {
        if (areEventsSimilar(event, deduplicated[i])) {
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(event);
      locationCounts[locationKey] = locationCount + 1;
    }
  }
  
  return deduplicated;
}

async function testAPILogic() {
  console.log('🔍 Testing API logic with real data...\n');

  try {
    // Test the exact query from the API
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('timestamp', sixtyDaysAgo.toISOString())
      .order('timestamp', { ascending: false });

    if (eventsError) {
      console.error('❌ Query error:', eventsError);
      return;
    }

    console.log(`✅ Raw query returned: ${eventsData?.length || 0} events`);

    // Filter for valid coordinates
    const validEvents = (eventsData || []).filter(item => {
      const lat = item.latitude;
      const lng = item.longitude;
      return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && 
             lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    });

    console.log(`📍 Valid coordinates: ${validEvents.length} events`);

    // Test deduplication
    console.log('\n🔧 Testing deduplication...');
    const deduplicated = deduplicateEvents(validEvents);
    console.log(`🔄 After deduplication: ${deduplicated.length} unique events`);

    // Analyze what was removed
    const removedCount = validEvents.length - deduplicated.length;
    console.log(`❌ Removed ${removedCount} duplicate events (${(removedCount / validEvents.length * 100).toFixed(1)}%)`);

    // Show location distribution
    const locationCounts = {};
    deduplicated.forEach(event => {
      const key = `${event.country || 'unknown'}`;
      locationCounts[key] = (locationCounts[key] || 0) + 1;
    });

    console.log('\n📍 Geographic distribution after deduplication:');
    Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([country, count]) => {
        console.log(`  - ${country}: ${count} events`);
      });

    // Show sample unique events
    console.log('\n📋 Sample unique events:');
    deduplicated.slice(0, 10).forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.title || event.summary}`);
      console.log(`     📍 ${event.country}, ${event.region} [${event.latitude.toFixed(2)}, ${event.longitude.toFixed(2)}]`);
      console.log(`     ⚠️  ${event.severity} severity`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAPILogic().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
});