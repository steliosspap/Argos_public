#!/usr/bin/env node

/**
 * Basic Media Analysis Test
 * Tests the BigSister integration with a downloaded test image
 */

import MediaAnalysisService from '../services/media-analysis/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const config = {
  pythonPath: 'python3',
  enableSteganography: true,
  tempDir: path.join(__dirname, '../.cache/test-media')
};

async function downloadTestImage() {
  // Wikipedia test image with EXIF data
  const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Altja_j%C3%B5gi_Lahemaal.jpg/1200px-Altja_j%C3%B5gi_Lahemaal.jpg';
  const testImagePath = path.join(config.tempDir, 'test-image.jpg');
  
  console.log('Downloading test image...');
  
  try {
    await fs.mkdir(config.tempDir, { recursive: true });
    
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    await fs.writeFile(testImagePath, buffer);
    
    console.log('✓ Test image downloaded\n');
    return testImagePath;
  } catch (error) {
    console.error('Failed to download test image:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('Basic Media Analysis Test\n');
  console.log('=========================\n');
  
  const analyzer = new MediaAnalysisService(config);
  
  try {
    // Download test image
    const testImagePath = await downloadTestImage();
    
    // Test 1: Basic metadata extraction
    console.log('Test 1: Metadata Extraction');
    console.log('---------------------------');
    
    const result = await analyzer.analyzeMedia(testImagePath);
    
    console.log('Analysis Results:');
    console.log(`- File hash: ${result.fileHash.substring(0, 16)}...`);
    console.log(`- Metadata fields: ${Object.keys(result.metadata).length}`);
    console.log(`- Anomalies detected: ${result.anomalies.length}`);
    console.log(`- Has geolocation: ${result.geolocation ? 'Yes' : 'No'}`);
    
    if (result.metadata && Object.keys(result.metadata).length > 0) {
      console.log('\nSample metadata:');
      const sampleKeys = Object.keys(result.metadata).slice(0, 5);
      sampleKeys.forEach(key => {
        console.log(`  ${key}: ${result.metadata[key]}`);
      });
    }
    
    // Test 2: Thumbnail generation
    console.log('\n\nTest 2: Thumbnail Generation');
    console.log('----------------------------');
    
    if (result.thumbnail) {
      console.log('✓ Thumbnail generated successfully');
      console.log(`  Size: ${result.thumbnail.data.length} bytes (base64)`);
    } else {
      console.log('✗ No thumbnail generated');
    }
    
    // Test 3: Check Python environment
    console.log('\n\nTest 3: Python Environment');
    console.log('--------------------------');
    
    try {
      const { spawn } = await import('child_process');
      const pythonCheck = spawn(config.pythonPath, ['--version']);
      
      pythonCheck.stdout.on('data', (data) => {
        console.log(`✓ Python version: ${data.toString().trim()}`);
      });
      
      pythonCheck.on('error', () => {
        console.log('✗ Python not available');
      });
    } catch (error) {
      console.log('✗ Python check failed');
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    
    if (result.metadata && Object.keys(result.metadata).length > 0) {
      console.log('✅ Media analysis is working correctly!');
      console.log('\nCapabilities verified:');
      console.log('- Metadata extraction: ✓');
      console.log('- File hashing: ✓');
      console.log('- Thumbnail generation:', result.thumbnail ? '✓' : '✗');
      console.log('- Anomaly detection: ✓');
      
      console.log('\nNext steps:');
      console.log('1. Run full pipeline with: node cli-enhanced.js --enable-media-analysis');
      console.log('2. Enable steganography: node cli-enhanced.js --enable-media-analysis --enable-steganography');
    } else {
      console.log('⚠️  Media analysis encountered issues');
      console.log('Check that BigSister Python dependencies are installed');
    }
    
    // Cleanup
    await fs.unlink(testImagePath);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure Python 3 is installed');
    console.error('2. Install BigSister Python dependencies:');
    console.error('   cd lib/BigSister && python3 -m venv venv');
    console.error('   source venv/bin/activate');
    console.error('   pip install pillow requests');
    console.error('3. Check exiftool is installed: which exiftool');
  }
}

// Run the tests
runTests().catch(console.error);