const fetch = require('node-fetch');

// First set invite_verified cookie to bypass invite requirement
const INVITE_COOKIE = 'invite_verified=true';

async function testLogin() {
  try {
    console.log('🔐 Testing login...\n');
    
    // Test login with admin credentials
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': INVITE_COOKIE
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'  // Default admin password
      }),
      redirect: 'manual'  // Don't follow redirects
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Login failed:', response.status, data);
      return;
    }

    console.log('✅ Login successful!');
    console.log('Token:', data.token);
    console.log('User:', data.user);
    
    // Extract auth cookie from response
    const cookies = response.headers.raw()['set-cookie'];
    const authCookie = cookies?.find(c => c.startsWith('authToken='));
    
    if (authCookie) {
      console.log('\n🍪 Auth cookie set:', authCookie.split(';')[0]);
    }
    
    // Test accessing admin invite codes with the token
    console.log('\n📋 Testing admin invite codes API...');
    
    const inviteResponse = await fetch('http://localhost:3000/api/admin/invite-codes', {
      headers: {
        'Cookie': `${INVITE_COOKIE}; ${authCookie || ''}`,
        'Authorization': `Bearer ${data.token}`
      }
    });
    
    if (!inviteResponse.ok) {
      const errorText = await inviteResponse.text();
      console.error('❌ Failed to fetch invite codes:', inviteResponse.status, errorText);
      return;
    }
    
    const inviteCodes = await inviteResponse.json();
    console.log('✅ Successfully fetched invite codes!');
    console.log(`Found ${inviteCodes.length} invite codes`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testLogin();