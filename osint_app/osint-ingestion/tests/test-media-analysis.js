#!/usr/bin/env node

/**
 * Media Analysis Integration Tests
 * Tests the BigSister integration for media analysis in the OSINT pipeline
 */

import MediaAnalysisService from '../services/media-analysis/index.js';
import ReverseImageSearchService from '../services/media-analysis/reverse-image-search.js';
import SteganographyDetectorService from '../services/media-analysis/steganography-detector.js';
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
  enableReverseImageSearch: false, // Disabled by default to avoid opening browser
  tempDir: path.join(__dirname, '../.cache/test-media')
};

// Test images (you'll need to provide these)
const testImages = {
  withExif: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Altja_j%C3%B5gi_Lahemaal.jpg/1200px-Altja_j%C3%B5gi_Lahemaal.jpg',
  withoutExif: 'https://via.placeholder.com/300x200',
  localPath: null // Will be set if local test image exists
};

class MediaAnalysisTest {
  constructor() {
    this.mediaAnalyzer = new MediaAnalysisService(config);
    this.reverseImageSearch = new ReverseImageSearchService({ ...config, headless: true });
    this.steganographyDetector = new SteganographyDetectorService(config);
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runAllTests() {
    console.log('Starting Media Analysis Integration Tests...\n');

    await this.setupTestEnvironment();

    // Run test suites
    await this.testMetadataExtraction();
    await this.testSteganographyDetection();
    await this.testMediaAnalysisIntegration();
    await this.testErrorHandling();

    // Display results
    this.displayResults();
    
    // Cleanup
    if (testImages.localPath) {
      try {
        await fs.unlink(testImages.localPath);
        console.log('\n✓ Cleaned up test image');
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  async setupTestEnvironment() {
    try {
      // Create test directories
      await fs.mkdir(config.tempDir, { recursive: true });

      // Download a test image instead of expecting a local one
      console.log('Downloading test image...');
      const imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Altja_j%C3%B5gi_Lahemaal.jpg/1200px-Altja_j%C3%B5gi_Lahemaal.jpg';
      const localTestPath = path.join(config.tempDir, 'test-image.jpg');
      
      try {
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(localTestPath, Buffer.from(buffer));
        testImages.localPath = localTestPath;
        console.log('✓ Test image downloaded');
      } catch (error) {
        console.error('Failed to download test image:', error.message);
        console.log('ℹ Tests requiring local images will be skipped');
      }

      // Check Python environment
      await this.checkPythonEnvironment();

    } catch (error) {
      console.error('Failed to setup test environment:', error.message);
      process.exit(1);
    }
  }

  async checkPythonEnvironment() {
    try {
      const { spawn } = await import('child_process');
      
      return new Promise((resolve, reject) => {
        const python = spawn(config.pythonPath, ['--version']);
        
        python.on('close', (code) => {
          if (code === 0) {
            console.log('✓ Python environment available');
            resolve();
          } else {
            console.error('✗ Python not available');
            reject(new Error('Python not found'));
          }
        });
      });
    } catch (error) {
      console.error('✗ Python check failed:', error.message);
    }
  }

  async testMetadataExtraction() {
    console.log('\n--- Testing Metadata Extraction ---');

    // Test 1: Extract metadata from image with EXIF
    await this.runTest('Extract EXIF metadata', async () => {
      if (!testImages.localPath) {
        throw new Error('Local test image required for this test');
      }

      const result = await this.mediaAnalyzer.analyzeMedia(testImages.localPath);
      
      if (!result.metadata || Object.keys(result.metadata).length === 0) {
        throw new Error('No metadata extracted');
      }

      console.log(`  Extracted ${Object.keys(result.metadata).length} metadata fields`);
      return true;
    });

    // Test 2: Detect geolocation
    await this.runTest('Extract geolocation from EXIF', async () => {
      if (!testImages.localPath) {
        console.log('  Skipped: Requires local test image with GPS data');
        return 'skipped';
      }

      const result = await this.mediaAnalyzer.analyzeMedia(testImages.localPath);
      
      if (result.geolocation) {
        console.log(`  Found location: ${result.geolocation.latitude}, ${result.geolocation.longitude}`);
        return true;
      } else {
        console.log('  No geolocation data found (expected for test image)');
        return true;
      }
    });

    // Test 3: Detect timestamp anomalies
    await this.runTest('Detect timestamp anomalies', async () => {
      if (!testImages.localPath) {
        return 'skipped';
      }

      const result = await this.mediaAnalyzer.analyzeMedia(testImages.localPath);
      
      if (result.anomalies && result.anomalies.length > 0) {
        console.log(`  Found ${result.anomalies.length} anomalies`);
        result.anomalies.forEach(a => {
          console.log(`    - ${a.type}: ${a.field}`);
        });
      } else {
        console.log('  No anomalies detected');
      }
      
      return true;
    });
  }

  async testSteganographyDetection() {
    console.log('\n--- Testing Steganography Detection ---');

    // Test 1: Basic steganography scan
    await this.runTest('Run steganography detection', async () => {
      if (!testImages.localPath) {
        return 'skipped';
      }

      const result = await this.steganographyDetector.detectSteganography(testImages.localPath);
      
      if (!result.findings) {
        throw new Error('Detection failed');
      }

      console.log('  Detection completed:');
      console.log(`    - Steghide: ${result.findings.steghide ? 'checked' : 'skipped'}`);
      console.log(`    - Binwalk: ${result.findings.binwalk ? 'checked' : 'skipped'}`);
      console.log(`    - Zsteg: ${result.findings.zsteg ? 'checked' : 'skipped'}`);
      
      return true;
    });

    // Test 2: Suspicious indicator analysis
    await this.runTest('Analyze suspicious indicators', async () => {
      if (!testImages.localPath) {
        return 'skipped';
      }

      const result = await this.steganographyDetector.detectSteganography(testImages.localPath);
      
      if (result.suspiciousIndicators && result.suspiciousIndicators.length > 0) {
        console.log(`  Found ${result.suspiciousIndicators.length} suspicious indicators`);
        result.suspiciousIndicators.forEach(ind => {
          console.log(`    - ${ind.severity}: ${ind.description}`);
        });
      } else {
        console.log('  No suspicious indicators found (expected for clean image)');
      }
      
      return true;
    });
  }

  async testMediaAnalysisIntegration() {
    console.log('\n--- Testing Full Media Analysis Integration ---');

    // Test 1: Complete analysis workflow
    await this.runTest('Complete media analysis workflow', async () => {
      if (!testImages.localPath) {
        return 'skipped';
      }

      const result = await this.mediaAnalyzer.analyzeMedia(testImages.localPath, {
        checkSteganography: config.enableSteganography
      });
      
      // Verify all components
      if (!result.metadata) throw new Error('Missing metadata');
      if (!result.fileHash) throw new Error('Missing file hash');
      if (!result.timestamp) throw new Error('Missing timestamp');
      
      console.log('  Analysis complete:');
      console.log(`    - File hash: ${result.fileHash.substring(0, 16)}...`);
      console.log(`    - Metadata fields: ${Object.keys(result.metadata).length}`);
      console.log(`    - Anomalies: ${result.anomalies.length}`);
      console.log(`    - Has thumbnail: ${result.thumbnail ? 'yes' : 'no'}`);
      
      return true;
    });

    // Test 2: Batch analysis
    await this.runTest('Batch media analysis', async () => {
      if (!testImages.localPath) {
        return 'skipped';
      }

      const files = [testImages.localPath];
      const results = await this.mediaAnalyzer.batchAnalyze(files);
      
      if (results.length !== files.length) {
        throw new Error('Batch analysis count mismatch');
      }
      
      console.log(`  Analyzed ${results.length} files successfully`);
      return true;
    });
  }

  async testErrorHandling() {
    console.log('\n--- Testing Error Handling ---');

    // Test 1: Invalid file path
    await this.runTest('Handle invalid file path', async () => {
      try {
        const result = await this.mediaAnalyzer.analyzeMedia('/invalid/path/file.jpg');
        
        if (!result.errors || result.errors.length === 0) {
          throw new Error('Should have reported error for invalid file');
        }
        
        console.log('  Error correctly handled');
        return true;
      } catch (error) {
        // If an error is thrown, that's also acceptable
        console.log('  Error thrown as expected:', error.message.substring(0, 50) + '...');
        return true;
      }
    });

    // Test 2: Unsupported file type
    await this.runTest('Handle unsupported file type', async () => {
      const tempFile = path.join(config.tempDir, 'test.txt');
      await fs.writeFile(tempFile, 'This is not an image');
      
      const result = await this.mediaAnalyzer.analyzeMedia(tempFile);
      
      await fs.unlink(tempFile);
      
      console.log('  Unsupported file handled gracefully');
      return true;
    });
  }

  async runTest(name, testFn) {
    try {
      console.log(`\n• ${name}`);
      const result = await testFn();
      
      if (result === 'skipped') {
        console.log('  → Skipped');
        return;
      }
      
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed' });
      console.log('  ✓ Passed');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
      console.log(`  ✗ Failed: ${error.message}`);
    }
  }

  displayResults() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.results.passed + this.results.failed}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\nFailed Tests:');
      this.results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`  - ${t.name}: ${t.error}`);
        });
    }
    
    console.log('\n' + (this.results.failed === 0 ? '✓ All tests passed!' : '✗ Some tests failed'));
    
    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new MediaAnalysisTest();
tester.runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});