#!/usr/bin/env node

/**
 * Fix final issues: ID generation and missing channel field
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixFinalIssues() {
  console.log('Fixing final issues...\n');
  
  try {
    // 1. Fix Source model to not send null ID
    const sourceModelPath = path.join(__dirname, '../models/Source.js');
    let sourceContent = await fs.readFile(sourceModelPath, 'utf8');
    
    // Find toDatabaseFormat method
    const toDatabaseRegex = /(toDatabaseFormat\(\) \{[\s\S]*?return \{)([\s\S]*?)(\};)/;
    const match = sourceContent.match(toDatabaseRegex);
    
    if (match) {
      let fields = match[2];
      // Remove the id field entirely - let database generate it
      fields = fields.replace(/\s*id: this\.id,?\n/, '\n');
      
      const newToDatabase = match[1] + fields + match[3];
      sourceContent = sourceContent.replace(toDatabaseRegex, newToDatabase);
      
      await fs.writeFile(sourceModelPath, sourceContent);
      console.log('✅ Fixed Source model - removed id field from inserts');
    }
    
    // 2. Add channel field to Event model
    const eventModelPath = path.join(__dirname, '../models/Event.js');
    let eventContent = await fs.readFile(eventModelPath, 'utf8');
    
    // Find the toDatabaseFormat return statement
    const eventToDatabaseRegex = /(toDatabaseFormat\(\) \{[\s\S]*?return \{)([\s\S]*?)(};)/;
    const eventMatch = eventContent.match(eventToDatabaseRegex);
    
    if (eventMatch) {
      let eventFields = eventMatch[2];
      
      // Add channel field after title
      if (!eventFields.includes('channel:')) {
        eventFields = eventFields.replace(
          /(\s+title: this\.title,)/,
          '$1\n      channel: this.channel || \'news\','
        );
      }
      
      const newEventToDatabase = eventMatch[1] + eventFields + eventMatch[3];
      eventContent = eventContent.replace(eventToDatabaseRegex, newEventToDatabase);
      
      // Also add channel property to constructor
      const constructorRegex = /(constructor\(data = \{\}\) \{[\s\S]*?)(this\.title = data\.title)/;
      const constructorMatch = eventContent.match(constructorRegex);
      
      if (constructorMatch && !eventContent.includes('this.channel = data.channel')) {
        eventContent = eventContent.replace(
          constructorRegex,
          '$1this.channel = data.channel || \'news\';\n    $2'
        );
      }
      
      await fs.writeFile(eventModelPath, eventContent);
      console.log('✅ Fixed Event model - added channel field');
    }
    
    console.log('\nDone! Now run:');
    console.log('  ./cli.js ingest --verbose --limit 5');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixFinalIssues();