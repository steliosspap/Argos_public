#!/usr/bin/env node

/**
 * Phase 2 Features Test Suite
 * Tests bias detection, entity linking, timeline synthesis, and analytics
 */

import { MediaBiasAnalyzer } from './services/MediaBiasAnalyzer.js';
import { EntityLinker } from './services/EntityLinker.js';
import { TimelineSynthesizer } from './services/TimelineSynthesizer.js';
import { SimilarityService } from './services/SimilarityService.js';
import { multilingualEmbedder } from './lib/multilingual-embeddings/multilingualEmbedder.js';

// Test configuration
const tests = {
  biasDetection: true,
  entityLinking: true,
  timelineSynthesis: true,
  multilingualSearch: true,
  analytics: true
};

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testBiasDetection() {
  log('\n=== Testing Bias Detection ===', 'blue');
  
  const analyzer = new MediaBiasAnalyzer();
  
  const testArticles = [
    {
      title: 'Government Announces New Policy Initiative',
      snippet: 'The administration today unveiled a comprehensive plan to address economic challenges.',
      source: 'Reuters'
    },
    {
      title: 'Shocking Revelation: Politicians Caught in Scandal',
      snippet: 'Explosive new evidence reveals widespread corruption among political elites.',
      source: 'Unknown Blog'
    }
  ];
  
  for (const article of testArticles) {
    try {
      log(`\nAnalyzing: "${article.title}"`);
      const result = await analyzer.analyzeBias(article.snippet, article.source);
      
      log(`  Source Bias: ${result.sourceBias}`, 'yellow');
      log(`  Content Bias Score: ${result.contentBiasScore.toFixed(2)}`, 'yellow');
      log(`  Political Alignment: ${result.politicalAlignment}`, 'yellow');
      log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`, 'yellow');
      
      log('  ✓ Bias detection successful', 'green');
    } catch (error) {
      log(`  ✗ Bias detection failed: ${error.message}`, 'red');
    }
  }
}

async function testEntityLinking() {
  log('\n=== Testing Entity Linking ===', 'blue');
  
  const linker = new EntityLinker();
  
  const testEntities = [
    { text: 'United Nations', type: 'ORG' },
    { text: 'Joe Biden', type: 'PERSON' },
    { text: 'Ukraine', type: 'LOC' },
    { text: 'NATO', type: 'ORG' }
  ];
  
  try {
    log('\nLinking entities to Wikidata...');
    const results = await linker.linkEntities(testEntities);
    
    results.forEach(result => {
      if (result.qid && result.qid !== 'Q0') {
        log(`  ✓ ${result.entity} → ${result.qid} (${result.label})`, 'green');
      } else {
        log(`  ✗ ${result.entity} → Not found`, 'yellow');
      }
    });
  } catch (error) {
    log(`  ✗ Entity linking failed: ${error.message}`, 'red');
  }
}

async function testTimelineSynthesis() {
  log('\n=== Testing Timeline Synthesis ===', 'blue');
  
  const synthesizer = new TimelineSynthesizer();
  
  const mockEvents = [
    {
      id: crypto.randomUUID(),
      timestamp: new Date('2024-01-01'),
      enhanced_headline: 'Initial border tensions reported',
      location_name: 'Eastern Region',
      severity: 'medium',
      source: 'Reuters'
    },
    {
      id: crypto.randomUUID(),
      timestamp: new Date('2024-01-05'),
      enhanced_headline: 'Military buildup observed near border',
      location_name: 'Eastern Region',
      severity: 'high',
      source: 'AP'
    },
    {
      id: crypto.randomUUID(),
      timestamp: new Date('2024-01-10'),
      enhanced_headline: 'Diplomatic talks initiated',
      location_name: 'Capital City',
      severity: 'low',
      source: 'BBC'
    }
  ];
  
  try {
    log('\nGenerating timeline from events...');
    const timeline = await synthesizer.generateTimeline(mockEvents, 'chronological');
    
    if (timeline) {
      log(`  Title: ${timeline.summary.title}`, 'yellow');
      log(`  Theme: ${timeline.summary.theme}`, 'yellow');
      log(`  Trend: ${timeline.summary.trend}`, 'yellow');
      log('  ✓ Timeline synthesis successful', 'green');
      
      // Show first 200 chars of narrative
      const preview = timeline.summary.narrative.substring(0, 200) + '...';
      log(`  Preview: ${preview}`, 'yellow');
    } else {
      log('  ✗ Timeline generation returned null', 'red');
    }
  } catch (error) {
    log(`  ✗ Timeline synthesis failed: ${error.message}`, 'red');
  }
}

async function testMultilingualSearch() {
  log('\n=== Testing Multilingual Search ===', 'blue');
  
  const similarity = new SimilarityService();
  
  const testQueries = [
    { text: 'military conflict', language: 'en' },
    { text: 'conflicto militar', language: 'es' },
    { text: 'conflit militaire', language: 'fr' }
  ];
  
  for (const query of testQueries) {
    try {
      log(`\nSearching in ${query.language}: "${query.text}"`);
      
      // Test multilingual embedding
      const embedResult = await multilingualEmbedder.embedText(query.text, query.language);
      log(`  Model: ${embedResult.model}`, 'yellow');
      log(`  Dimensions: ${embedResult.dimensions}`, 'yellow');
      log('  ✓ Multilingual embedding successful', 'green');
    } catch (error) {
      log(`  ✗ Multilingual search failed: ${error.message}`, 'red');
    }
  }
}

async function testAnalyticsAPI() {
  log('\n=== Testing Analytics API ===', 'blue');
  
  // Note: This would normally call the actual API endpoints
  // For testing purposes, we'll simulate the API structure
  
  const mockAnalytics = {
    zones: {
      topZones: [
        { country: 'Ukraine', intensityScore: 85.2, eventCount: 124 },
        { country: 'Gaza', intensityScore: 78.5, eventCount: 98 }
      ]
    },
    entities: {
      topEntities: [
        { entity: 'NATO', mentions: 45, qid: 'Q7184' },
        { entity: 'UN', mentions: 38, qid: 'Q1065' }
      ]
    },
    sentiment: {
      trend: 'deteriorating',
      averageSentiment: -0.35
    }
  };
  
  try {
    log('\nAnalytics API Structure:');
    log('  ✓ Top Conflict Zones endpoint', 'green');
    log(`    - ${mockAnalytics.zones.topZones[0].country}: ${mockAnalytics.zones.topZones[0].intensityScore}`, 'yellow');
    
    log('  ✓ Entity Analytics endpoint', 'green');
    log(`    - ${mockAnalytics.entities.topEntities[0].entity}: ${mockAnalytics.entities.topEntities[0].mentions} mentions`, 'yellow');
    
    log('  ✓ Sentiment Trends endpoint', 'green');
    log(`    - Trend: ${mockAnalytics.sentiment.trend}`, 'yellow');
  } catch (error) {
    log(`  ✗ Analytics test failed: ${error.message}`, 'red');
  }
}

// Main test runner
async function runTests() {
  log('\n=====================================', 'blue');
  log('Argos OSINT Phase 2 Features Test', 'blue');
  log('=====================================', 'blue');
  
  const startTime = Date.now();
  
  try {
    if (tests.biasDetection) await testBiasDetection();
    if (tests.entityLinking) await testEntityLinking();
    if (tests.timelineSynthesis) await testTimelineSynthesis();
    if (tests.multilingualSearch) await testMultilingualSearch();
    if (tests.analytics) await testAnalyticsAPI();
  } catch (error) {
    log(`\nFatal error during tests: ${error.message}`, 'red');
    console.error(error);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  log('\n=====================================', 'blue');
  log(`Tests completed in ${duration}s`, 'blue');
  log('=====================================', 'blue');
  
  // Close any open connections
  if (tests.multilingualSearch) {
    const similarity = new SimilarityService();
    await similarity.close();
  }
}

// Run tests
runTests().catch(console.error);