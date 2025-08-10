#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Dynamically import after env vars are loaded
async function run() {
  const { IntelligentIngestion } = await import('../src/lib/intelligent-ingestion.js');
  
  console.log('🚀 Running Tiny Enhanced Ingestion Test...');
  console.log('📍 This will test the enhanced tags implementation\n');
  
  const ingestion = new IntelligentIngestion({
    dryRun: false,
    verbose: true,
    limit: 2 // Super small for quick testing
  });
  
  try {
    const results = await ingestion.run();
    console.log('\n✅ Ingestion completed!');
    console.log('Results:', results);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

run();