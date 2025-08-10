#!/usr/bin/env node

const http = require('http');

async function testAnalyticsAPIs() {
  console.log('🧪 Testing Analytics APIs with escalation data...\n');

  const baseUrl = 'http://localhost:3000';
  
  const tests = [
    {
      name: 'Regional Analytics API',
      endpoint: '/api/analytics/regions',
      description: 'Test regional analytics with escalation scores'
    },
    {
      name: 'Top Countries API (Events)',
      endpoint: '/api/analytics/top-countries?metric=events&limit=5',
      description: 'Test top countries by event count'
    },
    {
      name: 'Top Countries API (Escalation)',
      endpoint: '/api/analytics/top-countries?metric=escalation&limit=5',
      description: 'Test top countries by escalation score'
    }
  ];

  for (const test of tests) {
    console.log(`📊 ${test.name}`);
    console.log(`   ${test.description}`);
    console.log(`   Testing: ${baseUrl}${test.endpoint}\n`);
    
    try {
      const response = await fetch(`${baseUrl}${test.endpoint}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ API Response successful');
        console.log(`   Status: ${response.status}`);
        
        if (data.data) {
          // Check for escalation analytics in the response
          const hasEscalationData = JSON.stringify(data).includes('escalation');
          console.log(`   Contains escalation data: ${hasEscalationData ? '✅ Yes' : '❌ No'}`);
          
          if (test.endpoint.includes('regions')) {
            console.log(`   Regions returned: ${data.data.regions?.length || 0}`);
            if (data.data.regions && data.data.regions.length > 0) {
              const firstRegion = data.data.regions[0];
              if (firstRegion.escalation_analytics) {
                console.log(`   Sample escalation analytics: avg=${firstRegion.escalation_analytics.avg_escalation_score}, level=${firstRegion.escalation_analytics.escalation_level}`);
              }
            }
          } else if (test.endpoint.includes('top-countries')) {
            console.log(`   Countries returned: ${data.data.countries?.length || 0}`);
            if (data.data.countries && data.data.countries.length > 0) {
              const firstCountry = data.data.countries[0];
              if (firstCountry.avg_escalation_score !== undefined) {
                console.log(`   Sample escalation data: ${firstCountry.country} - avg=${firstCountry.avg_escalation_score}, level=${firstCountry.escalation_level}`);
              }
            }
          }
        }
        
        console.log(`   Response size: ${JSON.stringify(data).length} characters`);
      } else {
        console.log('❌ API Response failed');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log('💥 Request failed');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('───────────────────────────────────────────────────\n');
  }
}

// Run the tests
testAnalyticsAPIs()
  .then(() => {
    console.log('🎉 Analytics API testing completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Testing failed:', error);
    process.exit(1);
  });