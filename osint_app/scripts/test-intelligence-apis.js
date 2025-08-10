#!/usr/bin/env node

/**
 * Test script for Intelligence API endpoints
 * Tests the new arms intelligence analysis APIs
 */

async function testIntelligenceAPIs() {
  console.log('🧪 Testing Intelligence APIs...\n');

  const baseUrl = 'http://localhost:3002';
  
  // Test data for arms intelligence analysis
  const testArmsDeal = {
    id: "test-001",
    buyer_country: "IL",
    seller_country: "US", 
    weapon_type: "F-35 Fighter Aircraft",
    quantity: 50,
    value_usd: 15000000000, // $15B deal
    status: "confirmed",
    contract_date: "2024-01-15T00:00:00Z",
    description: "Advanced stealth fighter aircraft procurement for regional defense enhancement",
    sources: ["https://example.com/defense-news"]
  };

  const tests = [
    {
      name: 'Single Arms Deal Intelligence Analysis',
      method: 'POST',
      endpoint: '/api/intelligence/analyze-arms',
      data: testArmsDeal,
      description: 'Test strategic intelligence analysis for high-value arms deal'
    },
    {
      name: 'Batch Arms Intelligence Analysis', 
      method: 'POST',
      endpoint: '/api/intelligence/batch-analyze',
      data: {
        deals: [
          testArmsDeal,
          {
            id: "test-002",
            buyer_country: "SA",
            seller_country: "FR",
            weapon_type: "Rafale Fighter Jets",
            value_usd: 8000000000,
            status: "pending"
          },
          {
            id: "test-003", 
            buyer_country: "IN",
            seller_country: "RU",
            weapon_type: "S-400 Air Defense System",
            value_usd: 5000000000,
            status: "confirmed"
          }
        ]
      },
      description: 'Test batch intelligence analysis for multiple deals'
    },
    {
      name: 'Intelligence Analytics Dashboard',
      method: 'GET', 
      endpoint: '/api/analytics/intelligence?limit=50',
      description: 'Test intelligence-enhanced analytics endpoint'
    }
  ];

  for (const test of tests) {
    console.log(`📊 ${test.name}`);
    console.log(`   ${test.description}`);
    console.log(`   Testing: ${test.method} ${baseUrl}${test.endpoint}\n`);
    
    try {
      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (test.data) {
        options.body = JSON.stringify(test.data);
      }

      const response = await fetch(`${baseUrl}${test.endpoint}`, options);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ API Response successful');
        console.log(`   Status: ${response.status}`);
        
        if (test.endpoint.includes('analyze-arms') && !test.endpoint.includes('batch')) {
          // Single analysis response
          if (data.data) {
            console.log(`   Risk Level: ${data.data.strategic_assessment?.risk_level || 'Unknown'}`);
            console.log(`   Deal Classification: ${data.data.market_intelligence?.deal_classification || 'Unknown'}`);
            console.log(`   Oversight Level: ${data.data.monitoring_priorities?.oversight_level || 'Unknown'}`);
            console.log(`   Confidence: ${data.data.confidence || 'Unknown'}`);
          }
        } else if (test.endpoint.includes('batch-analyze')) {
          // Batch analysis response
          if (data.data?.results) {
            console.log(`   Deals Analyzed: ${data.data.results.length}`);
            console.log(`   High Risk Deals: ${data.data.results.filter(r => r.strategic_assessment?.risk_level === 'HIGH' || r.strategic_assessment?.risk_level === 'CRITICAL').length}`);
            console.log(`   Strategic Deals: ${data.data.results.filter(r => r.market_intelligence?.deal_classification === 'strategic').length}`);
            if (data.data.strategic_overview) {
              console.log(`   Average Confidence: ${data.data.strategic_overview.avg_confidence || 'Unknown'}`);
            }
          }
        } else if (test.endpoint.includes('analytics/intelligence')) {
          // Intelligence analytics response
          if (data.data?.analytics) {
            console.log(`   Total Deals: ${data.data.analytics.total_deals || 0}`);
            console.log(`   Risk Distribution: CRITICAL:${data.data.analytics.risk_distribution?.CRITICAL || 0}, HIGH:${data.data.analytics.risk_distribution?.HIGH || 0}`);
            console.log(`   Strategic Insights: ${data.data.analytics.strategic_insights?.length || 0} insights`);
            console.log(`   Processing Summary: ${data.data.analytics.processing_summary?.deals_analyzed || 0} analyzed`);
          }
        }
        
        console.log(`   Response size: ${JSON.stringify(data).length} characters`);
      } else {
        console.log('❌ API Response failed');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${data.error?.message || data.message || 'Unknown error'}`);
        if (data.error?.details) {
          console.log(`   Details: ${JSON.stringify(data.error.details)}`);
        }
      }
      
    } catch (error) {
      console.log('💥 Request failed');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('───────────────────────────────────────────────────\n');
  }
}

// Run the tests
testIntelligenceAPIs()
  .then(() => {
    console.log('🎉 Intelligence API testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Testing failed:', error);
    process.exit(1);
  });