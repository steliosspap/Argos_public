// Debug script to test API endpoints
// Run this in browser console

async function testAPI() {
  console.log('=== Testing API Endpoints ===');
  
  // Test basic endpoint
  try {
    console.log('\n1. Testing /api/test');
    const testResponse = await fetch('/api/test');
    console.log('Status:', testResponse.status);
    console.log('Headers:', Object.fromEntries(testResponse.headers));
    const testData = await testResponse.text();
    console.log('Response:', testData);
    try {
      console.log('Parsed:', JSON.parse(testData));
    } catch (e) {
      console.log('Not valid JSON');
    }
  } catch (e) {
    console.error('Test endpoint error:', e);
  }
  
  // Test news endpoint
  try {
    console.log('\n2. Testing /api/news');
    const newsResponse = await fetch('/api/news', {
      headers: {
        'Accept': 'application/json',
      }
    });
    console.log('Status:', newsResponse.status);
    const contentType = newsResponse.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (contentType && contentType.includes('application/json')) {
      const newsData = await newsResponse.json();
      console.log('News data:', newsData);
    } else {
      const text = await newsResponse.text();
      console.log('Non-JSON response:', text.substring(0, 200));
    }
  } catch (e) {
    console.error('News endpoint error:', e);
  }
  
  // Test health endpoint
  try {
    console.log('\n3. Testing /api/health');
    const healthResponse = await fetch('/api/health');
    console.log('Status:', healthResponse.status);
    const healthData = await healthResponse.json();
    console.log('Health data:', healthData);
  } catch (e) {
    console.error('Health endpoint error:', e);
  }
  
  // Check environment
  console.log('\n4. Checking environment');
  console.log('User Agent:', navigator.userAgent);
  console.log('Is Safari:', /^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  
  // Check auth token
  console.log('\n5. Checking auth');
  console.log('Auth token:', localStorage.getItem('authToken') ? 'Present' : 'Missing');
}

// Run the test
testAPI();