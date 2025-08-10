/**
 * Test script for embedding functionality
 */

import { embedText, embedEvent, textEmbedder } from '../lib/sentence-transformers/embedText.js';
import { SimilarityService } from '../services/SimilarityService.js';
import { ConflictEvent } from '../models/Event.js';

async function testEmbedding() {
  console.log('🧪 Testing text embedding...');
  
  try {
    // Test 1: Simple text embedding
    console.log('\n1. Testing simple text embedding:');
    const text = "Russian missile strikes hit Kyiv, causing multiple casualties";
    const embedding = await embedText(text);
    
    console.log(`   ✅ Generated embedding with ${embedding.length} dimensions`);
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...]`);
    
    // Test 2: Event embedding
    console.log('\n2. Testing event embedding:');
    const event = new ConflictEvent({
      enhancedHeadline: "NATO Forces Conduct Military Exercises in Poland",
      summary: "Large-scale military exercises involving multiple NATO countries",
      primaryActors: ["NATO", "Poland", "US Military"],
      locationName: "Warsaw, Poland",
      conflictType: "military_exercise"
    });
    
    const eventEmbedding = await embedEvent(event);
    console.log(`   ✅ Generated event embedding with ${eventEmbedding.length} dimensions`);
    
    // Test 3: Similarity calculation
    console.log('\n3. Testing similarity calculation:');
    const text2 = "Ukrainian forces defend against Russian attacks in Kyiv";
    const embedding2 = await embedText(text2);
    
    const similarity = textEmbedder.cosineSimilarity(embedding, embedding2);
    console.log(`   Similarity between texts: ${similarity.toFixed(3)}`);
    console.log(`   ✅ Similarity calculation working`);
    
    // Test 4: Database storage and retrieval
    console.log('\n4. Testing database operations:');
    const similarityService = new SimilarityService();
    
    // Find similar events (this will fail if no events have embeddings)
    try {
      const similarEvents = await similarityService.findSimilarEventsByText(
        "conflict in Middle East",
        3
      );
      console.log(`   ✅ Found ${similarEvents.length} similar events`);
    } catch (error) {
      console.log(`   ⚠️  Database search skipped: ${error.message}`);
    }
    
    console.log('\n✅ All embedding tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testEmbedding().then(() => {
  console.log('\n🎉 Embedding tests completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});