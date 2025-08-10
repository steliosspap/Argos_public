#!/usr/bin/env node

/**
 * Restore original model files from backups
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restoreModels() {
  console.log('Restoring original model files...\n');
  
  try {
    const eventModelPath = path.join(__dirname, '../models/Event.js');
    const sourceModelPath = path.join(__dirname, '../models/Source.js');
    
    const eventBackupPath = eventModelPath + '.backup';
    const sourceBackupPath = sourceModelPath + '.backup';
    
    // Check if backups exist
    const eventBackupExists = await fs.access(eventBackupPath).then(() => true).catch(() => false);
    const sourceBackupExists = await fs.access(sourceBackupPath).then(() => true).catch(() => false);
    
    if (eventBackupExists) {
      await fs.copyFile(eventBackupPath, eventModelPath);
      await fs.unlink(eventBackupPath);
      console.log('✅ Restored Event model');
    } else {
      console.log('⚠️  No backup found for Event model');
    }
    
    if (sourceBackupExists) {
      await fs.copyFile(sourceBackupPath, sourceModelPath);
      await fs.unlink(sourceBackupPath);
      console.log('✅ Restored Source model');
    } else {
      console.log('⚠️  No backup found for Source model');
    }
    
    console.log('\n✅ Models restored to original state!');
    
  } catch (error) {
    console.error('Error restoring models:', error);
  }
}

restoreModels();