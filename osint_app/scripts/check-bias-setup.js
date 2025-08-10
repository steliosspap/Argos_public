/**
 * Check if bias detection system is properly configured
 * Run with: node scripts/check-bias-setup.js
 */

require('dotenv').config({ path: '.env.local' });

console.log('🔍 Checking Bias Detection System Configuration...\n');

// Check required environment variables
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'GOOGLE_API_KEY', 
  'GOOGLE_SEARCH_ENGINE_ID',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const optionalEnvVars = [
  'OPENAI_MODEL',
  'SUPABASE_SERVICE_KEY',
  'CRON_SECRET'
];

let hasErrors = false;

console.log('📋 Required Environment Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`   ❌ ${varName}: NOT SET`);
    hasErrors = true;
  }
});

console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`   ⚠️  ${varName}: Not set (using defaults)`);
  }
});

// Check if we can connect to Supabase
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('\n🔗 Testing Supabase Connection...');
  const { createClient } = require('@supabase/supabase-js');
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // Try to query the bias_analyses table
    supabase
      .from('bias_analyses')
      .select('count')
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.log(`   ❌ Supabase connection failed: ${error.message}`);
          console.log(`   💡 You may need to run the migration: database/migrations/add_bias_analysis_tables.sql`);
        } else {
          console.log(`   ✅ Supabase connection successful`);
        }
      });
  } catch (err) {
    console.log(`   ❌ Failed to create Supabase client: ${err.message}`);
  }
}

// Check OpenAI configuration
if (process.env.OPENAI_API_KEY) {
  console.log('\n🤖 OpenAI Configuration:');
  console.log(`   • Model: ${process.env.OPENAI_MODEL || 'gpt-4o (default)'}`);
  console.log(`   • API Key: ${process.env.OPENAI_API_KEY.substring(0, 10)}...`);
}

// Check Google Search configuration
if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
  console.log('\n🔍 Google Search Configuration:');
  console.log(`   • API Key: ${process.env.GOOGLE_API_KEY.substring(0, 10)}...`);
  console.log(`   • Search Engine ID: ${process.env.GOOGLE_SEARCH_ENGINE_ID}`);
}

// Instructions
console.log('\n📚 Next Steps:');
if (hasErrors) {
  console.log('   1. Add missing environment variables to .env.local');
  console.log('   2. Run the database migration if needed');
  console.log('   3. Start the Next.js development server: npm run dev');
  console.log('   4. Run the test script: node scripts/test-bias-analysis.js');
} else {
  console.log('   1. Make sure the Next.js server is running: npm run dev');
  console.log('   2. Run the test script: node scripts/test-bias-analysis.js');
  console.log('   3. Check the Intelligence Center for bias indicators on news items');
}

console.log('\n✅ Configuration check complete!');