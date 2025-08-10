#!/usr/bin/env node

/**
 * Fix field mapping between code and database
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixFieldMapping() {
  console.log('Fixing field mapping between code and database...\n');
  
  try {
    // 1. Update Source model to handle source_id
    const sourceModelPath = path.join(__dirname, '../models/Source.js');
    let sourceContent = await fs.readFile(sourceModelPath, 'utf8');
    
    // Update toDatabaseFormat to use source_id
    const toDatabaseFormatRegex = /toDatabaseFormat\(\) \{[\s\S]*?return \{([\s\S]*?)\};/;
    const match = sourceContent.match(toDatabaseFormatRegex);
    
    if (match) {
      let fieldsBlock = match[1];
      // Change id: this.id to source_id: this.id
      fieldsBlock = fieldsBlock.replace(/(\s+)id: this\.id,/, '$1source_id: this.id,');
      
      // Remove problematic fields temporarily
      fieldsBlock = fieldsBlock.replace(/(\s+)bias_source: this\.biasSource,/, '$1// bias_source: this.biasSource, // Schema cache issue');
      
      const newToDatabaseFormat = `toDatabaseFormat() {\n    return {${fieldsBlock}\n    };`;
      sourceContent = sourceContent.replace(toDatabaseFormatRegex, newToDatabaseFormat);
    }
    
    await fs.writeFile(sourceModelPath, sourceContent);
    console.log('✅ Updated Source model field mapping');
    
    // 2. Update Event model to remove missing fields
    const eventModelPath = path.join(__dirname, '../models/Event.js');
    let eventContent = await fs.readFile(eventModelPath, 'utf8');
    
    // Find toDatabaseFormat method
    const eventToDatabaseRegex = /toDatabaseFormat\(\) \{[\s\S]*?return \{([\s\S]*?)\};/;
    const eventMatch = eventContent.match(eventToDatabaseRegex);
    
    if (eventMatch) {
      let eventFields = eventMatch[1];
      
      // Remove fields that don't exist in database
      eventFields = eventFields.replace(/(\s+)enhanced_headline: this\.enhancedHeadline,/, '$1// enhanced_headline: this.enhancedHeadline, // Missing in DB');
      eventFields = eventFields.replace(/(\s+)casualties: this\.casualties,/, '$1// casualties: this.casualties, // Schema cache issue');
      
      const newEventToDatabase = `toDatabaseFormat() {\n    return {${eventFields}\n    };`;
      eventContent = eventContent.replace(eventToDatabaseRegex, newEventToDatabase);
    }
    
    await fs.writeFile(eventModelPath, eventContent);
    console.log('✅ Updated Event model field mapping');
    
    console.log('\n✅ Field mapping fixed!');
    console.log('\nNow run:');
    console.log('  ./cli.js ingest --verbose --limit 5');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixFieldMapping();