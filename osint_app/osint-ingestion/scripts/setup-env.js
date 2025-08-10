#!/usr/bin/env node

/**
 * Environment Setup Helper
 * Ensures environment variables are loaded correctly
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for .env.local files in multiple locations
const envPaths = [
  path.join(__dirname, '../.env.local'),
  path.join(__dirname, '../../.env.local'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env')
];

console.log('Checking for environment files...\n');

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`✓ Found: ${envPath}`);
    dotenv.config({ path: envPath });
    envLoaded = true;
  } else {
    console.log(`✗ Not found: ${envPath}`);
  }
}

if (!envLoaded) {
  console.error('\n❌ No environment files found!');
  process.exit(1);
}

console.log('\nEnvironment variables loaded:');
console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('- SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓ Set' : '✗ Missing');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing');
console.log('- GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? '✓ Set' : '✗ Missing');
console.log('- NEWSAPI_KEY:', process.env.NEWSAPI_KEY ? '✓ Set' : '✗ Missing');

// If running test-setup, import and run it
if (process.argv[2] === 'test') {
  console.log('\nRunning setup test...\n');
  await import('./test-setup.js');
}