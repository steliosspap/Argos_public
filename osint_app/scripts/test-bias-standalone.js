/**
 * Standalone test for bias detection system (no server required)
 * Run with: node scripts/test-bias-standalone.js
 */

require('dotenv').config({ path: '.env.local' });

// Import the analysis modules directly
const { BiasDetector } = require('../.next/server/chunks/lib_bias-detection_bias-detector.js');
const { FactChecker } = require('../.next/server/chunks/lib_corroboration_fact-checker.js');
const { AnalysisPipeline } = require('../.next/server/chunks/lib_analysis-pipeline.js');

async function testStandalone() {
  console.log('🧪 Testing Bias Detection System (Standalone)...\n');

  // Initialize the pipeline
  const pipeline = new AnalysisPipeline({
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  });

  // Test article
  const testArticle = {
    title: "Breaking: Major Climate Summit Reaches Historic Agreement",
    content: "World leaders at the climate summit have reached what many are calling a historic agreement to combat climate change. The deal includes commitments from major economies to reduce carbon emissions by 50% by 2030. Environmental groups praised the agreement as a crucial step forward, while some business leaders expressed concerns about the economic impact. The agreement was reached after intense negotiations that lasted through the night.",
    source: "Test News Agency",
    url: "https://example.com/climate-summit-" + Date.now() // Unique URL to avoid cache
  };

  console.log(`📰 Analyzing: "${testArticle.title}"\n`);

  try {
    const result = await pipeline.analyzeArticle(testArticle);
    
    console.log('✅ Analysis Complete!\n');
    
    console.log('📊 Bias Analysis:');
    console.log(`   • Overall Bias: ${result.biasAnalysis.overallBias} (${result.biasAnalysis.biasCategory})`);
    console.log(`   • Confidence: ${Math.round(result.biasAnalysis.confidence * 100)}%`);
    console.log(`   • Bias Types:`);
    console.log(`     - Political: ${result.biasAnalysis.biasTypes.political.toFixed(2)}`);
    console.log(`     - Sensationalism: ${result.biasAnalysis.biasTypes.sensationalism.toFixed(2)}`);
    console.log(`     - Emotional Language: ${result.biasAnalysis.biasTypes.emotionalLanguage.toFixed(2)}`);
    console.log(`     - Source Balance: ${result.biasAnalysis.biasTypes.sourceBalance.toFixed(2)}`);
    
    if (result.biasAnalysis.indicators.length > 0) {
      console.log(`   • Indicators:`);
      result.biasAnalysis.indicators.forEach(ind => {
        console.log(`     - ${ind.type} (${ind.severity}): ${ind.description}`);
      });
    }
    
    console.log('\n✅ Fact Check Results:');
    console.log(`   • Status: ${result.factCheckResult.overallVerification}`);
    console.log(`   • Verification Score: ${Math.round(result.factCheckResult.verificationScore * 100)}%`);
    console.log(`   • Confidence: ${Math.round(result.factCheckResult.confidence * 100)}%`);
    console.log(`   • Corroborating Sources: ${result.factCheckResult.corroboratingSources.length}`);
    console.log(`   • Geographic Coverage: ${result.factCheckResult.geographicCoverage.globalReach ? 'Global' : 'Regional'}`);
    
    console.log('\n🎯 Overall Trust Score: ${Math.round(result.overallTrustScore * 100)}%');
    console.log(`💬 Summary: ${result.summary}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Check if modules need to be built first
const fs = require('fs');
const path = require('path');

const modulePath = path.join(__dirname, '../.next/server/chunks/lib_analysis-pipeline.js');
if (!fs.existsSync(modulePath)) {
  console.log('⚠️  Build artifacts not found. The Next.js app needs to be built first.');
  console.log('   Run: npm run build');
  process.exit(1);
}

// Run the test
testStandalone().catch(console.error);