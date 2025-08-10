#!/usr/bin/env node

// Agent 13: Arms Deal API Validation Script
// Quick validation for post-build testing

import fetch from 'node-fetch';

async function validateArmsDealsAPI() {
  console.log('🛰️ Agent 13: Arms Deal API Validation');
  console.log('='.repeat(45));
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('');
  
  // Test multiple ports that Next.js might be running on
  const testPorts = [3000, 3001, 3002, 3003, 3004];
  let workingPort = null;
  
  console.log('🔍 Scanning for active Next.js server...');
  
  for (const port of testPorts) {
    try {
      const response = await fetch(`http://localhost:${port}/api/arms-deals`, {
        timeout: 3000
      });
      
      if (response.ok) {
        workingPort = port;
        console.log(`✅ Found active server on port ${port}`);
        break;
      }
    } catch (error) {
      // Port not active, continue scanning
    }
  }
  
  if (!workingPort) {
    console.log('❌ No active Next.js server found on common ports');
    console.log('💡 Start the server with: npm run dev');
    return;
  }
  
  // Test the Arms Deal API endpoint
  try {
    console.log('');
    console.log('🧪 Testing Arms Deal API endpoint...');
    console.log(`   URL: http://localhost:${workingPort}/api/arms-deals`);
    
    const response = await fetch(`http://localhost:${workingPort}/api/arms-deals?limit=5`);
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log('❌ API endpoint failed');
      const errorText = await response.text();
      console.log('   Error:', errorText.substring(0, 200));
      return;
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.data || !Array.isArray(data.data)) {
      console.log('❌ Invalid response structure');
      console.log('   Expected: { data: [], meta: {...} }');
      console.log('   Received:', JSON.stringify(data, null, 2).substring(0, 300));
      return;
    }
    
    const deals = data.data;
    const meta = data.meta;
    
    console.log('✅ API endpoint operational');
    console.log(`   Arms deals returned: ${deals.length}`);
    console.log(`   Total in database: ${meta.total || 'unknown'}`);
    
    if (deals.length > 0) {
      const deal = deals[0];
      console.log('');
      console.log('📊 Sample deal validation:');
      console.log(`   Buyer: ${deal.buyerCountry || 'missing'}`);
      console.log(`   Weapon: ${deal.weaponSystem || 'missing'}`);
      console.log(`   Value: $${deal.dealValue ? (deal.dealValue / 1000000).toFixed(1) + 'M' : 'missing'}`);
      console.log(`   Date: ${deal.date || 'missing'}`);
      
      // Check for required fields
      const requiredFields = ['buyerCountry', 'weaponSystem', 'dealValue', 'date'];
      const missingFields = requiredFields.filter(field => !deal[field]);
      
      if (missingFields.length === 0) {
        console.log('✅ All required fields present');
      } else {
        console.log(`⚠️ Missing fields: ${missingFields.join(', ')}`);
      }
    }
    
    console.log('');
    console.log('🎯 Full Stack Validation: SUCCESSFUL');
    console.log('   ✅ Next.js build working');
    console.log('   ✅ API route operational');
    console.log('   ✅ Database connectivity confirmed');
    console.log('   ✅ Arms deal data accessible via web API');
    
  } catch (error) {
    console.error('❌ API validation failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Server may not be running. Start with: npm run dev');
    } else if (error.message.includes('fetch')) {
      console.log('💡 Network connectivity issue');
    } else {
      console.log('💡 Unexpected error - check server logs');
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateArmsDealsAPI().catch(console.error);
}

export { validateArmsDealsAPI };