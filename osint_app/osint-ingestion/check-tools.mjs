#!/usr/bin/env node

/**
 * Check availability of BigSister dependencies
 */

import ToolAvailability from './services/media-analysis/tool-availability.js';

console.log('Checking BigSister tool availability...\n');

const tools = new ToolAvailability();
tools.printStatus();

const capabilities = tools.getCapabilities();

console.log('\nCapabilities:');
console.log('- Metadata extraction:', capabilities.metadata ? '✓ Available' : '✗ Limited');
console.log('- Steganography detection:', capabilities.steganography.any ? '✓ Available' : '✗ Not available');
console.log('  - Steghide (JPEG):', capabilities.steganography.steghide ? '✓ Yes' : '✗ No');
console.log('  - Binwalk (All formats):', capabilities.steganography.binwalk ? '✓ Yes' : '✗ No');
console.log('  - Zsteg (PNG/BMP):', capabilities.steganography.zsteg ? '✓ Yes' : '✗ No');
console.log('- Image processing:', capabilities.imageProcessing ? '✓ Available' : '✗ Not available');

console.log('\n📊 Summary:');
if (capabilities.steganography.binwalk && capabilities.steganography.zsteg) {
  console.log('✅ You have good steganography coverage even without steghide!');
  console.log('   - Binwalk can detect embedded files in any format');
  console.log('   - Zsteg handles PNG/BMP specific steganography');
}

console.log('\n🚀 Ready to use media analysis:');
console.log('   node cli-enhanced.js --enable-media-analysis');
console.log('\n   With steganography detection:');
console.log('   node cli-enhanced.js --enable-media-analysis --enable-steganography');

process.exit(0);