#!/usr/bin/env node

/**
 * Validates that all required environment variables are set
 * Run this before building or deploying
 */

// Load environment variables from .env files if they exist
// This will work locally and be skipped in Vercel (files don't exist there)
const fs = require('fs');
const path = require('path');

if (fs.existsSync(path.join(process.cwd(), '.env.local'))) {
  require('dotenv').config({ path: '.env.local' });
}
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  require('dotenv').config({ path: '.env' });
}

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
];

const optionalEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY', // Only needed for analytics at runtime
];

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;

// Check required variables
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required: ${varName}`);
    hasErrors = true;
  } else {
    const value = process.env[varName];
    const maskedValue = value.substring(0, 6) + '...' + value.substring(value.length - 4);
    console.log(`✅ Found: ${varName} = ${maskedValue}`);
  }
});

console.log('\n📋 Optional variables:');

// Check optional variables
optionalEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.log(`⚠️  Missing optional: ${varName} (analytics will log to console)`);
  } else {
    console.log(`✅ Found: ${varName}`);
  }
});

// Validate Mapbox token format
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token.startsWith('pk.')) {
    console.error('\n❌ Invalid Mapbox token format - should start with "pk."');
    hasErrors = true;
  }
}

// Validate Supabase URL format
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url.includes('supabase.co')) {
    console.warn('\n⚠️  Supabase URL does not contain "supabase.co" - verify it\'s correct');
  }
}

if (hasErrors) {
  console.error('\n❌ Environment validation failed!');
  console.error('Please set all required environment variables in .env.local or your deployment platform.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  console.log('Ready to build and deploy.');
}