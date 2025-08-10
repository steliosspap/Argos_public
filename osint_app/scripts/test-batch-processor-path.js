#!/usr/bin/env node

/**
 * Test script to verify batch-processor.js can be found in expected locations
 */

const fs = require('fs');
const path = require('path');

function testBatchProcessorPath() {
  console.log('🔍 Testing batch-processor.js path resolution...\n');
  
  // Get current working directory
  const cwd = process.cwd();
  console.log(`Current working directory: ${cwd}`);
  
  // Check possible locations
  const locations = [
    path.join(cwd, 'scripts', 'batch-processor.js'),
    path.join(cwd, 'osint-ingestion', 'batch-processor.js'),
    path.join(__dirname, 'batch-processor.js'),
    path.join(__dirname, '..', 'osint-ingestion', 'batch-processor.js')
  ];
  
  console.log('\n📍 Checking locations:');
  locations.forEach((location, index) => {
    const exists = fs.existsSync(location);
    const status = exists ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${location}`);
    
    if (exists) {
      const stats = fs.lstatSync(location);
      if (stats.isSymbolicLink()) {
        const target = fs.readlinkSync(location);
        console.log(`   → Symbolic link to: ${target}`);
      }
    }
  });
  
  // Test the path resolution logic from the GitHub Actions workflow
  console.log('\n🧪 Testing GitHub Actions workflow logic:');
  
  const scriptsPath = path.join(cwd, 'scripts', 'batch-processor.js');
  const osintPath = path.join(cwd, 'osint-ingestion', 'batch-processor.js');
  
  if (fs.existsSync(scriptsPath)) {
    console.log('✅ Would use scripts/batch-processor.js');
    console.log(`   Full path: ${scriptsPath}`);
  } else if (fs.existsSync(osintPath)) {
    console.log('✅ Would use osint-ingestion/batch-processor.js');
    console.log(`   Full path: ${osintPath}`);
  } else {
    console.log('❌ Neither location found - workflow would fail');
  }
  
  // Test require resolution
  console.log('\n📦 Testing Node.js require resolution:');
  try {
    const batchProcessor = require('./batch-processor.js');
    console.log('✅ Can require batch-processor.js from scripts directory');
  } catch (error) {
    console.log('❌ Cannot require batch-processor.js from scripts directory');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test from osint-ingestion directory
  try {
    const batchProcessor = require('../osint-ingestion/batch-processor.js');
    console.log('✅ Can require batch-processor.js from osint-ingestion directory');
  } catch (error) {
    console.log('❌ Cannot require batch-processor.js from osint-ingestion directory');
    console.log(`   Error: ${error.message}`);
  }
  
  console.log('\n✨ Path resolution test completed!');
}

// Run the test
testBatchProcessorPath();