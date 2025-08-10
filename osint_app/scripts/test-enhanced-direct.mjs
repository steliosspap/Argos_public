#!/usr/bin/env node

/**
 * Test the enhanced ingestion directly
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Import the implementation
const { IntelligentIngestion } = await import('../src/lib/intelligent-ingestion.ts');

console.log('🚀 Testing Enhanced Ingestion Directly...\n');

const ingestion = new IntelligentIngestion({
  dryRun: false,
  verbose: true,
  limit: 10 // Small limit for testing
});

try {
  console.log('Starting ingestion...');
  const results = await ingestion.run();
  console.log('\n✅ Success! Results:', results);
} catch (error) {
  console.error('\n❌ Error:', error);
}