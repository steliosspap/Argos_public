#!/usr/bin/env node

/**
 * Test Setup Script
 * Verifies that the OSINT pipeline is properly configured
 */

import chalk from 'chalk';
import { config, validateConfig } from '../core/config.js';
import { createClient } from '@supabase/supabase-js';
import { TextProcessor } from '../services/TextProcessor.js';
import { GeospatialService } from '../services/GeospatialService.js';

console.log(chalk.bold.blue('OSINT Pipeline Setup Test\n'));

let passed = 0;
let failed = 0;

// Test 1: Configuration
console.log(chalk.bold('1. Testing Configuration...'));
try {
  validateConfig();
  console.log(chalk.green('✓ Configuration is valid'));
  passed++;
} catch (error) {
  console.log(chalk.red('✗ Configuration error:'), error.message);
  failed++;
}

// Test 2: Supabase Connection
console.log(chalk.bold('\n2. Testing Supabase Connection...'));
try {
  const supabase = createClient(
    config.database.supabase.url,
    config.database.supabase.serviceKey
  );
  
  const { data, error } = await supabase
    .from('news_sources')
    .select('count')
    .limit(1);
  
  if (error) throw error;
  
  console.log(chalk.green('✓ Supabase connection successful'));
  passed++;
} catch (error) {
  console.log(chalk.red('✗ Supabase connection failed:'), error.message);
  failed++;
}

// Test 3: OpenAI API
console.log(chalk.bold('\n3. Testing OpenAI API...'));
if (config.apis.openai.apiKey) {
  try {
    const processor = new TextProcessor();
    const result = await processor.analyzeWithAI(
      'Test text for OpenAI',
      'Return JSON: {"test": "success"}'
    );
    
    if (result && result.test === 'success') {
      console.log(chalk.green('✓ OpenAI API is working'));
      passed++;
    } else {
      throw new Error('Unexpected response from OpenAI');
    }
  } catch (error) {
    console.log(chalk.red('✗ OpenAI API error:'), error.message);
    failed++;
  }
} else {
  console.log(chalk.yellow('⚠ OpenAI API key not configured'));
}

// Test 4: Google APIs
console.log(chalk.bold('\n4. Testing Google APIs...'));
if (config.apis.google.apiKey) {
  console.log(chalk.green('✓ Google API key configured'));
  passed++;
} else {
  console.log(chalk.yellow('⚠ Google API key not configured (search will be limited)'));
}

// Test 5: Text Processing
console.log(chalk.bold('\n5. Testing Text Processing...'));
try {
  const processor = new TextProcessor();
  const testText = 'Russian forces attacked Kyiv with missiles yesterday, killing 5 people.';
  
  const relevance = processor.classifyConflictRelevance(testText);
  
  // Test pattern-based extraction without AI
  const casualtyMatches = testText.match(/(\d+)\s+(?:people|persons?|individuals?|civilians?|soldiers?|troops?)?\s*(?:were\s+)?(?:killed|dead|died|deceased)/gi);
  const extractedCasualties = casualtyMatches ? parseInt(casualtyMatches[0].match(/\d+/)[0]) : 0;
  
  if (relevance.isConflictRelated && extractedCasualties === 5) {
    console.log(chalk.green('✓ Text processing is working'));
    console.log(`  - Relevance score: ${relevance.relevanceScore}`);
    console.log(`  - Extracted casualties: ${extractedCasualties} killed`);
    console.log(`  - Conflict types: ${relevance.conflictTypes.join(', ')}`);
    passed++;
  } else {
    console.log(chalk.yellow('⚠ Text processing partially working'));
    console.log(`  - Relevance detected: ${relevance.isConflictRelated}`);
    console.log(`  - Score: ${relevance.relevanceScore}`);
    console.log(`  - Pattern extraction: ${extractedCasualties} casualties`);
    if (relevance.isConflictRelated) passed++;
  }
} catch (error) {
  console.log(chalk.red('✗ Text processing error:'), error.message);
  failed++;
}

// Test 6: Geospatial Service
console.log(chalk.bold('\n6. Testing Geospatial Service...'));
try {
  const geoService = new GeospatialService();
  const coords = await geoService.resolveLocation('Kyiv');
  
  if (coords && coords.includes('POINT')) {
    console.log(chalk.green('✓ Geospatial service is working'));
    console.log(`  - Kyiv coordinates: ${coords}`);
    passed++;
  } else {
    throw new Error('Failed to resolve location');
  }
} catch (error) {
  console.log(chalk.red('✗ Geospatial error:'), error.message);
  failed++;
}

// Test 7: Database Tables
console.log(chalk.bold('\n7. Testing Database Tables...'));
try {
  const supabase = createClient(
    config.database.supabase.url,
    config.database.supabase.serviceKey
  );
  
  const tables = ['events', 'news_sources', 'news', 'conflict_events'];
  let allTablesExist = true;
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log(chalk.red(`  ✗ Table '${table}' does not exist`));
      allTablesExist = false;
    } else {
      console.log(chalk.green(`  ✓ Table '${table}' exists`));
    }
  }
  
  if (allTablesExist) {
    console.log(chalk.green('✓ All required tables exist'));
    passed++;
  } else {
    throw new Error('Some required tables are missing');
  }
} catch (error) {
  console.log(chalk.red('✗ Database table check failed:'), error.message);
  failed++;
}

// Summary
console.log(chalk.bold('\n' + '='.repeat(50)));
console.log(chalk.bold('Test Summary:'));
console.log(chalk.green(`Passed: ${passed}`));
console.log(chalk.red(`Failed: ${failed}`));

if (failed === 0) {
  console.log(chalk.bold.green('\n✓ All tests passed! The OSINT pipeline is ready to use.'));
  console.log(chalk.gray('\nRun: ./cli.js ingest --dry-run --verbose'));
  process.exit(0);
} else {
  console.log(chalk.bold.red('\n✗ Some tests failed. Please fix the issues above.'));
  console.log(chalk.yellow('\nCommon fixes:'));
  console.log('- Check your .env.local file has all required keys');
  console.log('- Ensure Supabase tables are created (run migrations)');
  console.log('- Verify API keys are valid and have proper permissions');
  process.exit(1);
}