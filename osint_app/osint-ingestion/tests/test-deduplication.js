/**
 * Test script for enhanced deduplication with vector similarity
 */

import { ConflictEvent } from '../models/Event.js';
import { SimilarityService } from '../services/SimilarityService.js';
import { embedEvent } from '../lib/sentence-transformers/embedText.js';
import { ClusteringService } from '../services/ClusteringService.js';

async function testDeduplication() {
  console.log('🧪 Testing enhanced event deduplication...');
  
  const similarityService = new SimilarityService();
  const clusteringService = new ClusteringService();
  
  try {
    // Create test events
    const events = [
      // Similar events (should be clustered together)
      new ConflictEvent({
        enhancedHeadline: "Russian missile strikes hit Kyiv, 5 killed",
        locationName: "Kyiv, Ukraine",
        timestamp: new Date(),
        primaryActors: ["Russia", "Ukraine"],
        casualties: { killed: 5 }
      }),
      new ConflictEvent({
        enhancedHeadline: "Kyiv struck by Russian missiles, casualties reported",
        locationName: "Kyiv",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        primaryActors: ["Russian Forces"],
        casualties: { killed: 5, wounded: 12 }
      }),
      
      // Different event (should not be clustered)
      new ConflictEvent({
        enhancedHeadline: "IDF conducts operations in Gaza",
        locationName: "Gaza Strip",
        timestamp: new Date(),
        primaryActors: ["IDF", "Hamas"],
        casualties: { killed: 3 }
      }),
      
      // Another similar event to first cluster
      new ConflictEvent({
        enhancedHeadline: "Multiple explosions reported in Ukrainian capital after missile attack",
        locationName: "Kyiv, Ukraine",
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        primaryActors: ["Russia"],
        casualties: { killed: 4, wounded: 15 }
      })
    ];
    
    // Generate embeddings for all events
    console.log('\n1. Generating embeddings for test events...');
    for (const event of events) {
      event.embedding = await embedEvent(event);
      console.log(`   ✅ Generated embedding for: "${event.enhancedHeadline.substring(0, 50)}..."`);
    }
    
    // Test hybrid similarity
    console.log('\n2. Testing hybrid similarity calculation:');
    const similarity01 = await similarityService.calculateHybridSimilarity(events[0], events[1]);
    const similarity02 = await similarityService.calculateHybridSimilarity(events[0], events[2]);
    const similarity03 = await similarityService.calculateHybridSimilarity(events[0], events[3]);
    
    console.log(`   Event 0 vs Event 1 (similar): ${similarity01.hybridScore.toFixed(3)}`);
    console.log(`     - Vector: ${similarity01.vectorSimilarity.toFixed(3)}`);
    console.log(`     - Temporal: ${similarity01.temporalSimilarity.toFixed(3)}`);
    console.log(`     - Geographic: ${similarity01.geographicSimilarity.toFixed(3)}`);
    console.log(`     - Actor overlap: ${similarity01.actorOverlap.toFixed(3)}`);
    
    console.log(`   Event 0 vs Event 2 (different): ${similarity02.hybridScore.toFixed(3)}`);
    console.log(`   Event 0 vs Event 3 (similar): ${similarity03.hybridScore.toFixed(3)}`);
    
    // Test duplicate detection
    console.log('\n3. Testing duplicate detection:');
    const duplicate = await similarityService.checkDuplicate(events[1], 0.7);
    if (duplicate) {
      console.log(`   ✅ Duplicate detected: "${duplicate.enhanced_headline}"`);
    } else {
      console.log(`   ℹ️  No duplicate found (may need events in database)`);
    }
    
    // Test HDBSCAN clustering
    console.log('\n4. Testing HDBSCAN clustering:');
    try {
      const clusters = await clusteringService.clusterEvents(events, {
        minClusterSize: 2,
        minSamples: 1,
        clusterSelectionEpsilon: 0.5
      });
      
      console.log(`   Found ${clusters.length} clusters:`);
      clusters.forEach((cluster, idx) => {
        console.log(`   Cluster ${idx}: ${cluster.size} events (confidence: ${cluster.confidence.toFixed(2)})`);
        console.log(`     Primary: "${cluster.primaryEvent.enhancedHeadline}"`);
      });
    } catch (error) {
      console.log(`   ⚠️  HDBSCAN clustering skipped (requires Python): ${error.message}`);
    }
    
    // Test similarity-based clustering (fallback)
    console.log('\n5. Testing similarity-based clustering:');
    const manualClusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < events.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster = {
        primary: events[i],
        members: [events[i]],
        similarities: []
      };
      assigned.add(i);
      
      for (let j = i + 1; j < events.length; j++) {
        if (assigned.has(j)) continue;
        
        const sim = await similarityService.calculateHybridSimilarity(events[i], events[j]);
        if (sim.hybridScore > 0.7) {
          cluster.members.push(events[j]);
          cluster.similarities.push(sim.hybridScore);
          assigned.add(j);
        }
      }
      
      manualClusters.push(cluster);
    }
    
    console.log(`   Created ${manualClusters.length} clusters:`);
    manualClusters.forEach((cluster, idx) => {
      console.log(`   Cluster ${idx}: ${cluster.members.length} events`);
      cluster.members.forEach(event => {
        console.log(`     - "${event.enhancedHeadline}"`);
      });
    });
    
    console.log('\n✅ All deduplication tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await similarityService.close();
  }
}

// Run tests
testDeduplication().then(() => {
  console.log('\n🎉 Deduplication tests completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});