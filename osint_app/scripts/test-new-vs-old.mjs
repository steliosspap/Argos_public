#!/usr/bin/env node

/**
 * Compare the OLD vs NEW ingestion implementations
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📊 Comparing Ingestion Implementations:\n');

// Check OLD implementation
const oldPath = join(__dirname, '../osint-ingestion/intelligent-ingestion.js');
const oldExists = fs.existsSync(oldPath);
console.log(`1. OLD Implementation (single-pass):`);
console.log(`   📍 Path: /osint-ingestion/intelligent-ingestion.js`);
console.log(`   ✅ Exists: ${oldExists}`);
if (oldExists) {
  const oldContent = fs.readFileSync(oldPath, 'utf8');
  const hasRound2 = oldContent.includes('Round 2') || oldContent.includes('round2');
  const hasTwoRound = oldContent.includes('performTargetedSearch') || oldContent.includes('extractEntities');
  console.log(`   🔍 Has Two-Round Search: ${hasRound2 || hasTwoRound ? 'YES' : 'NO'}`);
}

console.log('\n2. NEW Implementation (two-round):');
const newPath = join(__dirname, '../src/lib/intelligent-ingestion.ts');
const newExists = fs.existsSync(newPath);
console.log(`   📍 Path: /src/lib/intelligent-ingestion.ts`);
console.log(`   ✅ Exists: ${newExists}`);
if (newExists) {
  const newContent = fs.readFileSync(newPath, 'utf8');
  const hasRound1 = newContent.includes('ROUND 1:') || newContent.includes('Round 1');
  const hasRound2 = newContent.includes('ROUND 2:') || newContent.includes('Round 2');
  const hasExtraction = newContent.includes('extractEntitiesAndKeywords');
  const hasTargeted = newContent.includes('performTargetedSearch');
  console.log(`   🔍 Has Round 1: ${hasRound1 ? 'YES' : 'NO'}`);
  console.log(`   🔍 Has Round 2: ${hasRound2 ? 'YES' : 'NO'}`);
  console.log(`   🔍 Has Entity Extraction: ${hasExtraction ? 'YES' : 'NO'}`);
  console.log(`   🔍 Has Targeted Search: ${hasTargeted ? 'YES' : 'NO'}`);
}

console.log('\n3. What we SHOULD be using:');
console.log('   ✨ The NEW implementation in /src/lib/intelligent-ingestion.ts');
console.log('   ✨ It has the enhanced two-round algorithm');
console.log('   ✨ It extracts entities and performs targeted searches');

console.log('\n4. Recent Usage:');
console.log('   ⚠️  We\'ve been mistakenly using the OLD implementation');
console.log('   ⚠️  The run-enhanced.cjs script uses the OLD one');
console.log('   ✅ The API route correctly imports from the NEW one');

console.log('\n📝 Summary:');
console.log('   - OLD: Basic single-pass search');
console.log('   - NEW: Enhanced two-round search with entity extraction');
console.log('   - We should ONLY use the NEW implementation!');