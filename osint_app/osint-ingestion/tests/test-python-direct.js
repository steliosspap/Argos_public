#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPythonExecution() {
  console.log('Testing Python execution...\n');
  
  // Download test image
  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Altja_j%C3%B5gi_Lahemaal.jpg/300px-Altja_j%C3%B5gi_Lahemaal.jpg';
  const tempDir = path.join(__dirname, '../.cache/test');
  const testImagePath = path.join(tempDir, 'test.jpg');
  
  await fs.mkdir(tempDir, { recursive: true });
  
  console.log('Downloading test image...');
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(testImagePath, Buffer.from(buffer));
  console.log('✓ Test image saved to:', testImagePath);
  
  // Test 1: Direct Python execution
  console.log('\nTest 1: Direct Python execution');
  console.log('-------------------------------');
  
  const venvPython = path.join(__dirname, '../lib/BigSister/venv/bin/python');
  const scriptPath = path.join(__dirname, '../lib/BigSister/src/main_headless.py');
  
  const python = spawn(venvPython, [scriptPath, testImagePath]);
  
  let output = '';
  let error = '';
  
  python.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  python.stderr.on('data', (data) => {
    error += data.toString();
  });
  
  python.on('close', (code) => {
    console.log('Exit code:', code);
    
    if (error) {
      console.log('Stderr:', error);
    }
    
    if (output) {
      console.log('Stdout:', output.substring(0, 200) + '...');
      
      try {
        const result = JSON.parse(output);
        console.log('\n✓ Successfully parsed JSON output');
        console.log('Result keys:', Object.keys(result));
      } catch (e) {
        console.log('\n✗ Failed to parse JSON:', e.message);
      }
    }
    
    // Test 2: Inline Python execution
    console.log('\n\nTest 2: Inline Python execution');
    console.log('--------------------------------');
    
    const wrapperScript = `
import sys
import json
sys.path.insert(0, '${path.join(__dirname, '../lib/BigSister/src')}')

try:
    from main_headless import run_metadata_chain
    result = run_metadata_chain('${testImagePath}')
    print(json.dumps(result))
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
`;
    
    const python2 = spawn(venvPython, ['-c', wrapperScript]);
    
    let output2 = '';
    let error2 = '';
    
    python2.stdout.on('data', (data) => {
      output2 += data.toString();
    });
    
    python2.stderr.on('data', (data) => {
      error2 += data.toString();
    });
    
    python2.on('close', async (code2) => {
      console.log('Exit code:', code2);
      
      if (error2) {
        console.log('Stderr:', error2);
      }
      
      if (output2) {
        console.log('Stdout:', output2.substring(0, 200) + '...');
        
        try {
          const result = JSON.parse(output2);
          console.log('\n✓ Successfully parsed JSON output');
          console.log('Result:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
        } catch (e) {
          console.log('\n✗ Failed to parse JSON:', e.message);
          console.log('Raw output:', output2);
        }
      }
      
      // Cleanup
      await fs.unlink(testImagePath);
      console.log('\n✓ Test complete');
    });
  });
}

testPythonExecution().catch(console.error);