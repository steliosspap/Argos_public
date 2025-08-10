#!/usr/bin/env node

/**
 * Comprehensive temporary fix for all schema mismatches
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyComprehensiveFix() {
  console.log('Applying comprehensive temporary fix...\n');
  
  try {
    // 1. Fix Event model
    const eventModelPath = path.join(__dirname, '../models/Event.js');
    let eventContent = await fs.readFile(eventModelPath, 'utf8');
    
    // Comment out problematic fields in toDatabaseFormat
    eventContent = eventContent.replace(
      /enhanced_headline: this\.enhancedHeadline,/,
      '// enhanced_headline: this.enhancedHeadline, // TEMP: Commented out'
    );
    
    // The casualties line is already commented from previous fix
    
    await fs.writeFile(eventModelPath, eventContent);
    console.log('✅ Fixed Event model');
    
    // 2. Fix Source model to use source_id instead of id
    const sourceModelPath = path.join(__dirname, '../models/Source.js');
    let sourceContent = await fs.readFile(sourceModelPath, 'utf8');
    
    // Change id to source_id in toDatabaseFormat
    sourceContent = sourceContent.replace(
      /(\s+)id: this\.id,/,
      '$1source_id: this.id, // TEMP: Using source_id instead of id'
    );
    
    await fs.writeFile(sourceModelPath, sourceContent);
    console.log('✅ Fixed Source model');
    
    // 3. Fix IngestionService to handle source_id
    const ingestionPath = path.join(__dirname, '../services/IngestionService.js');
    let ingestionContent = await fs.readFile(ingestionPath, 'utf8');
    
    // Update the query to use source_id
    ingestionContent = ingestionContent.replace(
      /\.eq\('normalized_name', source\.normalizedName\)/,
      '.eq(\'normalized_name\', source.normalizedName || source.name.toLowerCase().replace(/[^a-z0-9]/g, \'_\'))'
    );
    
    await fs.writeFile(ingestionPath, ingestionContent);
    console.log('✅ Fixed IngestionService');
    
    console.log('\n✅ Comprehensive fix applied!');
    console.log('\nThe pipeline should now work. Run:');
    console.log('  ./cli.js ingest --verbose --limit 5');
    
  } catch (error) {
    console.error('Error applying fix:', error);
  }
}

applyComprehensiveFix();