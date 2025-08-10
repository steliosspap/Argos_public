#!/usr/bin/env node

/**
 * Production Deployment Validation Script
 * Validates the Argos app is ready for production deployment
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const DOMAIN = 'argosintel.org';
const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'
];

const CRITICAL_PAGES = [
  '/',
  '/news',
  '/analytics', 
  '/arms-deals',
  '/signup',
  '/feedback',
  '/admin'
];

const API_ENDPOINTS = [
  '/api/conflicts',
  '/api/news',
  '/api/arms-deals',
  '/api/analytics/regions'
];

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkEnvironmentVariables() {
  log('\n🔍 Checking Environment Variables...', 'blue');
  
  let allValid = true;
  
  REQUIRED_ENV_VARS.forEach(envVar => {
    const value = process.env[envVar];
    if (!value) {
      log(`❌ Missing: ${envVar}`, 'red');
      allValid = false;
    } else if (value.includes('your_') || value.includes('YOUR_')) {
      log(`❌ Default value detected: ${envVar}`, 'red');
      allValid = false;
    } else {
      log(`✅ ${envVar}: ${value.substring(0, 20)}...`, 'green');
    }
  });
  
  return allValid;
}

function validateSupabaseConfig() {
  log('\n🗄️  Validating Supabase Configuration...', 'blue');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    log('❌ Supabase configuration incomplete', 'red');
    return false;
  }
  
  // Validate URL format
  try {
    const url = new URL(supabaseUrl);
    if (!url.hostname.includes('.supabase.co')) {
      log('❌ Invalid Supabase URL format', 'red');
      return false;
    }
    log(`✅ Supabase URL format valid: ${url.hostname}`, 'green');
  } catch (error) {
    log('❌ Invalid Supabase URL', 'red');
    return false;
  }
  
  // Validate key format (basic check)
  if (!supabaseKey.startsWith('eyJ')) {
    log('❌ Supabase anon key format appears invalid', 'red');
    return false;
  }
  
  log('✅ Supabase configuration appears valid', 'green');
  return true;
}

function validateMapboxConfig() {
  log('\n🗺️  Validating Mapbox Configuration...', 'blue');
  
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  if (!mapboxToken) {
    log('❌ Mapbox token missing', 'red');
    return false;
  }
  
  if (!mapboxToken.startsWith('pk.')) {
    log('❌ Mapbox token format appears invalid', 'red');
    return false;
  }
  
  log('✅ Mapbox configuration appears valid', 'green');
  return true;
}

async function testHttpsRequest(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 10000 }, (response) => {
      resolve({
        status: response.statusCode,
        headers: response.headers,
        success: response.statusCode >= 200 && response.statusCode < 400
      });
    });
    
    request.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

async function validateDomain() {
  log(`\n🌐 Validating Domain: ${DOMAIN}...`, 'blue');
  
  const baseUrl = `https://${DOMAIN}`;
  
  // Test main domain
  const mainTest = await testHttpsRequest(baseUrl);
  if (mainTest.success) {
    log(`✅ ${DOMAIN} is accessible`, 'green');
    
    // Check SSL
    if (mainTest.headers['strict-transport-security']) {
      log('✅ HTTPS/SSL properly configured', 'green');
    } else {
      log('⚠️  HSTS header not detected', 'yellow');
    }
  } else {
    log(`❌ ${DOMAIN} not accessible: ${mainTest.error || mainTest.status}`, 'red');
    return false;
  }
  
  // Test www redirect
  const wwwTest = await testHttpsRequest(`https://www.${DOMAIN}`);
  if (wwwTest.success || wwwTest.status === 301 || wwwTest.status === 302) {
    log('✅ www redirect appears to be working', 'green');
  } else {
    log('⚠️  www redirect may not be configured', 'yellow');
  }
  
  return true;
}

async function validatePages() {
  log('\n📄 Validating Critical Pages...', 'blue');
  
  const baseUrl = `https://${DOMAIN}`;
  let allValid = true;
  
  for (const page of CRITICAL_PAGES) {
    const url = `${baseUrl}${page}`;
    const result = await testHttpsRequest(url);
    
    if (result.success) {
      log(`✅ ${page}`, 'green');
    } else {
      log(`❌ ${page} - ${result.error || result.status}`, 'red');
      allValid = false;
    }
  }
  
  return allValid;
}

async function validateAPIEndpoints() {
  log('\n🔌 Validating API Endpoints...', 'blue');
  
  const baseUrl = `https://${DOMAIN}`;
  let allValid = true;
  
  for (const endpoint of API_ENDPOINTS) {
    const url = `${baseUrl}${endpoint}`;
    const result = await testHttpsRequest(url);
    
    if (result.success) {
      log(`✅ ${endpoint}`, 'green');
    } else {
      log(`❌ ${endpoint} - ${result.error || result.status}`, 'red');
      allValid = false;
    }
  }
  
  return allValid;
}

function displaySecurityChecklist() {
  log('\n🔒 Security Checklist:', 'blue');
  log('  □ Environment variables are production values (not defaults)');
  log('  □ Supabase RLS policies are enabled');
  log('  □ Admin panel requires authentication');
  log('  □ API keys are properly secured');
  log('  □ HTTPS is enforced');
  log('  □ Security headers are configured');
  log('  □ No console.log statements in production code');
}

function displayPerformanceChecklist() {
  log('\n⚡ Performance Checklist:', 'blue');
  log('  □ Run Google PageSpeed Insights');
  log('  □ Test Core Web Vitals');
  log('  □ Verify image optimization');
  log('  □ Check bundle size');
  log('  □ Test on mobile devices');
  log('  □ Verify map rendering performance');
}

async function main() {
  log('🚀 Argos Production Validation', 'blue');
  log('======================================');
  
  const results = {
    envVars: checkEnvironmentVariables(),
    supabase: validateSupabaseConfig(),
    mapbox: validateMapboxConfig(),
    domain: await validateDomain(),
    pages: await validatePages(),
    apis: await validateAPIEndpoints()
  };
  
  log('\n📊 Validation Summary:', 'blue');
  log('======================================');
  
  Object.entries(results).forEach(([key, result]) => {
    const status = result ? '✅' : '❌';
    const color = result ? 'green' : 'red';
    log(`${status} ${key}: ${result ? 'PASS' : 'FAIL'}`, color);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    log('\n🎉 All validations passed! Production deployment ready.', 'green');
  } else {
    log('\n⚠️  Some validations failed. Please address issues before production.', 'red');
  }
  
  displaySecurityChecklist();
  displayPerformanceChecklist();
  
  log('\n📚 Additional Testing:', 'blue');
  log(`  • Visit: https://${DOMAIN}`);
  log(`  • Test: https://www.${DOMAIN} (should redirect)`);
  log('  • Verify all forms submit successfully');
  log('  • Check real-time map functionality');
  log('  • Test admin panel access');
  
  process.exit(allPassed ? 0 : 1);
}

// Run validation
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };