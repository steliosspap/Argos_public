#!/usr/bin/env node

/**
 * Temporary fix: Modify models to exclude columns that aren't recognized by schema cache
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyTemporaryFix() {
  console.log('Applying temporary fix to bypass schema cache issues...\n');
  
  try {
    // 1. Backup original files
    const eventModelPath = path.join(__dirname, '../models/Event.js');
    const sourceModelPath = path.join(__dirname, '../models/Source.js');
    
    const eventBackupPath = eventModelPath + '.backup';
    const sourceBackupPath = sourceModelPath + '.backup';
    
    // Create backups
    await fs.copyFile(eventModelPath, eventBackupPath);
    await fs.copyFile(sourceModelPath, sourceBackupPath);
    console.log('✅ Created backup files');
    
    // 2. Modify Event model to comment out casualties
    let eventContent = await fs.readFile(eventModelPath, 'utf8');
    
    // Comment out casualties in toDatabaseFormat
    eventContent = eventContent.replace(
      /casualties: this\.casualties,/,
      '// casualties: this.casualties, // TEMP: Commented out due to schema cache issue'
    );
    
    await fs.writeFile(eventModelPath, eventContent);
    console.log('✅ Modified Event model');
    
    // 3. Modify Source model to comment out bias_source
    let sourceContent = await fs.readFile(sourceModelPath, 'utf8');
    
    // Comment out bias_source in toDatabaseFormat
    sourceContent = sourceContent.replace(
      /bias_source: this\.biasSource,/,
      '// bias_source: this.biasSource, // TEMP: Commented out due to schema cache issue'
    );
    
    await fs.writeFile(sourceModelPath, sourceContent);
    console.log('✅ Modified Source model');
    
    console.log('\n✅ Temporary fix applied!');
    console.log('\nYou can now run the pipeline without the schema cache errors.');
    console.log('\nTo restore original files later, run:');
    console.log('  node scripts/restore-models.js');
    
  } catch (error) {
    console.error('Error applying fix:', error);
  }
}

applyTemporaryFix();