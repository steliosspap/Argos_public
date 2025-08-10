#!/usr/bin/env node

/**
 * Fix reliability field to convert decimal to integer in Event model
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixReliabilityField() {
  console.log('Fixing reliability field conversion in Event model...\n');
  
  try {
    const eventModelPath = path.join(__dirname, '../models/Event.js');
    let eventContent = await fs.readFile(eventModelPath, 'utf8');
    
    // Find the toDatabaseFormat method and update reliability line
    const reliabilityRegex = /(\s+)reliability: this\.reliability,/;
    
    if (eventContent.match(reliabilityRegex)) {
      // Replace with conversion to integer (0-10 scale)
      eventContent = eventContent.replace(
        reliabilityRegex,
        '$1reliability: Math.round((this.reliability || 0.8) * 10), // Convert 0-1 to 0-10 integer'
      );
      
      await fs.writeFile(eventModelPath, eventContent);
      console.log('✅ Updated Event model to convert reliability to integer');
    } else {
      console.log('⚠️  Could not find reliability field in toDatabaseFormat');
    }
    
    console.log('\nNow run:');
    console.log('  ./cli.js ingest --verbose --limit 5');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixReliabilityField();