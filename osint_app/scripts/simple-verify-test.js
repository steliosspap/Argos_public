const fetch = require('node-fetch');

async function testVerify() {
  console.log('Testing verify-invite endpoint...\n');
  
  // Use a code we know exists
  const testCode = 'TESTCIYK';
  
  try {
    const response = await fetch('http://localhost:3000/api/verify-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inviteCode: testCode })
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('\n✅ Verification successful');
      console.log('Check the server logs for [verify-invite] messages');
      console.log('The usage count should have increased by 1');
    } else {
      console.log('\n❌ Verification failed');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testVerify();