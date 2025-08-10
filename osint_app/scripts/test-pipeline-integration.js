#!/usr/bin/env node

/**
 * Integration test for the complete ingestion pipeline
 * Verifies ES module fixes and pipeline functionality
 */

const { spawn } = require('child_process');
const path = require('path');

async function runTest(scriptPath, args = [], timeout = 30000) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Testing: ${scriptPath} ${args.join(' ')}`);
    
    const process = spawn('node', [scriptPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..')
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const timer = setTimeout(() => {
      process.kill();
      resolve({ 
        success: false, 
        error: 'Timeout', 
        stdout: stdout.slice(-500), 
        stderr: stderr.slice(-500) 
      });
    }, timeout);
    
    process.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        code,
        stdout: stdout.slice(-1000),
        stderr: stderr.slice(-1000)
      });
    });
    
    process.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        error: error.message,
        stdout,
        stderr
      });
    });
  });
}

async function main() {
  console.log('🚀 Pipeline Integration Test Suite');
  console.log('=====================================\n');
  
  const tests = [
    {
      name: 'Global RSS Fetcher - Help',
      script: 'scripts/global-rss-fetcher.js',
      args: [],
      timeout: 10000,
      expectSuccess: true
    },
    {
      name: 'Batch Processor - Help', 
      script: 'scripts/batch-processor.js',
      args: ['help'],
      timeout: 10000,
      expectSuccess: true
    },
    {
      name: 'Test Batch Processor Path',
      script: 'scripts/test-batch-processor-path.js',
      args: [],
      timeout: 10000,
      expectSuccess: true
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await runTest(test.script, test.args, test.timeout);
    
    if (result.success === test.expectSuccess) {
      console.log(`✅ ${test.name}: PASSED`);
      passed++;
    } else {
      console.log(`❌ ${test.name}: FAILED`);
      console.log(`   Code: ${result.code}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.stderr) {
        console.log(`   Stderr: ${result.stderr}`);
      }
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${(passed / (passed + failed) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Pipeline is operational.');
    console.log('\n✅ Ready for production deployment');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review issues above.');
    process.exit(1);
  }
}

main().catch(console.error);