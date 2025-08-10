#!/usr/bin/env node

/**
 * Check availability of BigSister dependencies
 */

const ToolAvailability = require('./services/media-analysis/tool-availability.js');

console.log('Checking BigSister tool availability...\n');

const tools = new ToolAvailability();
tools.printStatus();

const capabilities = tools.getCapabilities();

console.log('\nCapabilities:');
console.log('- Metadata extraction:', capabilities.metadata ? 'Available' : 'Limited');
console.log('- Steganography detection:', capabilities.steganography.any ? 'Available' : 'Not available');
console.log('  - Steghide:', capabilities.steganography.steghide ? 'Yes' : 'No');
console.log('  - Binwalk:', capabilities.steganography.binwalk ? 'Yes' : 'No');
console.log('  - Zsteg:', capabilities.steganography.zsteg ? 'Yes' : 'No');
console.log('- Image processing:', capabilities.imageProcessing ? 'Available' : 'Not available');

if (!capabilities.steganography.any) {
  console.log('\n⚠️  Warning: No steganography tools are available.');
  console.log('The media analysis will still work but without hidden data detection.');
}

console.log('\nNext steps:');
console.log('1. Continue with installation script to get remaining tools');
console.log('2. Run: npm install');
console.log('3. Test with: node tests/test-media-analysis.js');