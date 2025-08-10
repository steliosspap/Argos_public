#!/usr/bin/env node

/**
 * Test Entity Linking Integration
 */

import { EventExtractor } from './services/EventExtractor.js';
import { EntityLinker } from './services/EntityLinker.js';

async function testEntityLinking() {
  console.log('\n=== Testing Entity Linking Integration ===\n');
  
  // Test 1: Direct entity linking
  console.log('Test 1: Direct Entity Linking');
  console.log('-'.repeat(50));
  
  const entityLinker = new EntityLinker();
  
  const testEntities = [
    { text: 'Vladimir Putin', type: 'PERSON', confidence: 0.9 },
    { text: 'NATO', type: 'ORG', confidence: 0.95 },
    { text: 'Ukraine', type: 'LOC', confidence: 0.9 },
    { text: 'Moscow', type: 'LOC', confidence: 0.85 }
  ];
  
  const linkedEntities = await entityLinker.linkEntities(testEntities);
  
  console.log('\nLinked Entities:');
  linkedEntities.forEach(entity => {
    console.log(`- ${entity.entity} (${entity.type})`);
    console.log(`  QID: ${entity.qid || 'Not found'}`);
    console.log(`  Label: ${entity.label || 'N/A'}`);
    console.log(`  Confidence: ${entity.confidence?.toFixed(2) || '0.00'}`);
    console.log(`  Source: ${entity.source || 'Unknown'}`);
  });
  
  // Test 2: Entity linking in event extraction
  console.log('\n\nTest 2: Entity Linking in Event Extraction');
  console.log('-'.repeat(50));
  
  const eventExtractor = new EventExtractor();
  
  const testArticle = {
    id: 'test-001',
    title: 'NATO Secretary General Meets with Ukrainian President in Kyiv',
    snippet: 'NATO Secretary General Jens Stoltenberg met with Ukrainian President Volodymyr Zelensky in Kyiv today to discuss ongoing military support.',
    content: 'NATO Secretary General Jens Stoltenberg met with Ukrainian President Volodymyr Zelensky in Kyiv today to discuss ongoing military support. The meeting comes as Russian forces continue their operations in eastern Ukraine. Officials from the United States and European Union were also present at the discussions.',
    source: 'Reuters',
    publishedDate: new Date()
  };
  
  const result = await eventExtractor.analyzeArticle(testArticle);
  
  console.log('\nExtracted Entities:');
  if (result.entities) {
    console.log('Persons:', result.entities.persons?.map(p => p.text || p).join(', ') || 'None');
    console.log('Organizations:', result.entities.organizations?.map(o => o.text || o).join(', ') || 'None');
    console.log('Locations:', result.entities.locations?.map(l => l.text || l).join(', ') || 'None');
  }
  
  console.log('\nLinked Entities:');
  if (result.linkedEntities && result.linkedEntities.length > 0) {
    result.linkedEntities.forEach(entity => {
      console.log(`- ${entity.entity}: ${entity.qid} (${entity.confidence?.toFixed(2)})`);
    });
  } else {
    console.log('No linked entities found');
  }
  
  console.log('\nEvents with Entity Links:');
  if (result.events && result.events.length > 0) {
    result.events.forEach((event, idx) => {
      console.log(`\nEvent ${idx + 1}: ${event.title}`);
      if (event.entityLinks && event.entityLinks.length > 0) {
        console.log('Entity Links:');
        event.entityLinks.forEach(link => {
          console.log(`  - ${link.entity}: ${link.qid} (${link.type})`);
        });
      } else {
        console.log('  No entity links');
      }
    });
  }
  
  // Test 3: Context-aware entity linking
  console.log('\n\nTest 3: Context-Aware Entity Linking');
  console.log('-'.repeat(50));
  
  const contextText = 'The conflict in Gaza continues as Israeli forces target Hamas positions. Palestinian officials report civilian casualties.';
  const contextEntities = [
    { text: 'Gaza', type: 'LOC' },
    { text: 'Israeli', type: 'ORG' },
    { text: 'Hamas', type: 'ORG' },
    { text: 'Palestinian', type: 'ORG' }
  ];
  
  const contextLinked = await entityLinker.linkEntitiesWithContext(contextText, contextEntities);
  
  console.log('\nContext-aware linked entities:');
  contextLinked.forEach(entity => {
    console.log(`- ${entity.entity}: ${entity.qid} (${entity.confidence?.toFixed(2)})`);
  });
}

// Run tests
testEntityLinking().catch(console.error);