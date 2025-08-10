#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

async function testDeduplication() {
  console.log('🔍 Testing API deduplication...\n');

  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/events');
    const data = await response.json();

    console.log(`📊 API Response:`);
    console.log(`  - Status: ${response.status}`);
    console.log(`  - Total events returned: ${data.total || 0}`);
    console.log(`  - Data array length: ${data.data?.length || 0}`);

    if (data.data && data.data.length > 0) {
      // Analyze the events
      const countries = new Set();
      const regions = new Set();
      const severities = { low: 0, medium: 0, high: 0, critical: 0 };
      
      data.data.forEach(event => {
        countries.add(event.country);
        regions.add(event.region);
        severities[event.severity] = (severities[event.severity] || 0) + 1;
      });

      console.log(`\n📍 Geographic distribution:`);
      console.log(`  - Countries: ${countries.size} unique`);
      console.log(`  - Regions: ${regions.size} unique`);
      
      console.log(`\n⚠️  Severity distribution:`);
      Object.entries(severities).forEach(([level, count]) => {
        if (count > 0) {
          console.log(`  - ${level}: ${count} events`);
        }
      });

      // Check temporal distribution
      const now = new Date();
      const timeRanges = {
        '1 hour': 0,
        '24 hours': 0,
        '7 days': 0,
        '30 days': 0,
        'older': 0
      };

      data.data.forEach(event => {
        const age = now - new Date(event.timestamp);
        const hours = age / (1000 * 60 * 60);
        
        if (hours <= 1) timeRanges['1 hour']++;
        else if (hours <= 24) timeRanges['24 hours']++;
        else if (hours <= 24 * 7) timeRanges['7 days']++;
        else if (hours <= 24 * 30) timeRanges['30 days']++;
        else timeRanges['older']++;
      });

      console.log(`\n🕐 Temporal distribution:`);
      Object.entries(timeRanges).forEach(([range, count]) => {
        if (count > 0) {
          console.log(`  - Within ${range}: ${count} events`);
        }
      });

      // Show sample events
      console.log(`\n📋 Sample events:`);
      data.data.slice(0, 5).forEach((event, i) => {
        console.log(`  ${i + 1}. ${event.title}`);
        console.log(`     📍 ${event.country}, ${event.region}`);
        console.log(`     ⚠️  ${event.severity} severity`);
        console.log(`     🕐 ${new Date(event.timestamp).toLocaleString()}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the Next.js app is running on http://localhost:3000');
  }
}

testDeduplication().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
});