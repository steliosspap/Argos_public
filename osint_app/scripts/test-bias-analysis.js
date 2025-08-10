/**
 * Test script for bias detection and fact-checking system
 * Run with: node scripts/test-bias-analysis.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const http = require('http');

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => Promise.resolve(json) });
        } catch (e) {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => Promise.reject(e) });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testBiasAnalysis() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Test articles with different bias levels
  const testArticles = [
    {
      title: "Government Announces New Climate Policy",
      content: "The government today announced a comprehensive new climate policy aimed at reducing carbon emissions by 50% by 2030. Environmental groups praised the move as a necessary step, while some business leaders expressed concerns about economic impacts.",
      source: "Reuters",
      url: "https://example.com/climate-policy-1"
    },
    {
      title: "Radical Left Pushes Extreme Climate Agenda",
      content: "Socialist politicians are pushing their radical climate agenda that will destroy American jobs and cripple our economy. These extreme measures are nothing but a power grab by the far-left elite who want to control every aspect of our lives.",
      source: "Example News",
      url: "https://example.com/climate-policy-2"
    },
    {
      title: "Corporate Greed Blocks Climate Action",
      content: "Once again, corporate fascists and their Republican puppets have blocked crucial climate legislation. These climate deniers care more about their profits than the future of our planet. The capitalist system continues to fail us.",
      source: "Example Blog",
      url: "https://example.com/climate-policy-3"
    }
  ];

  console.log('🧪 Testing Bias Analysis API...\n');

  for (const article of testArticles) {
    console.log(`\n📰 Testing article: "${article.title}"`);
    console.log(`   Source: ${article.source}`);
    
    try {
      // Test bias analysis
      const response = await makeRequest(`${baseUrl}/api/analysis/bias`, {
        method: 'POST',
        body: JSON.stringify(article)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`   ❌ Analysis failed: ${error.message}`);
        continue;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const { biasAnalysis, factCheckResult, overallTrustScore } = result.data;
        
        console.log('\n   📊 Bias Analysis:');
        console.log(`      • Bias Score: ${biasAnalysis.overallBias} (${biasAnalysis.biasCategory})`);
        console.log(`      • Confidence: ${Math.round(biasAnalysis.confidence * 100)}%`);
        console.log(`      • Sensationalism: ${Math.round(biasAnalysis.biasTypes.sensationalism * 100)}%`);
        console.log(`      • Source Balance: ${Math.round(biasAnalysis.biasTypes.sourceBalance * 100)}%`);
        
        if (biasAnalysis.indicators.length > 0) {
          console.log(`      • Key Indicators:`);
          biasAnalysis.indicators.slice(0, 3).forEach(ind => {
            console.log(`        - ${ind.type} (${ind.severity}): ${ind.description}`);
          });
        }
        
        console.log('\n   ✅ Fact Check:');
        console.log(`      • Status: ${factCheckResult.overallVerification}`);
        console.log(`      • Score: ${Math.round(factCheckResult.verificationScore * 100)}%`);
        console.log(`      • Sources: ${factCheckResult.corroboratingSources.length}`);
        
        console.log('\n   🎯 Overall Trust Score: ${Math.round(overallTrustScore * 100)}%');
        console.log(`   💬 Summary: ${result.data.summary}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  // Test batch analysis
  console.log('\n\n🔄 Testing Batch Analysis...');
  
  try {
    const batchResponse = await makeRequest(`${baseUrl}/api/analysis/batch`, {
      method: 'POST',
      body: JSON.stringify({ limit: 5 })
    });

    if (batchResponse.ok) {
      const batchResult = await batchResponse.json();
      console.log(`   ✅ Analyzed ${batchResult.analyzed} articles from database`);
    } else {
      console.log('   ❌ Batch analysis failed');
    }
  } catch (error) {
    console.error(`   ❌ Batch error: ${error.message}`);
  }

  console.log('\n✅ Testing complete!');
}

// Run the test
testBiasAnalysis().catch(console.error);