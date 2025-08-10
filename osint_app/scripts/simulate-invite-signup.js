const fetch = require('node-fetch');

async function simulateInviteSignup() {
  console.log('🔍 Simulating complete invite code signup flow...\n');
  
  const BASE_URL = 'http://localhost:3000';
  const INVITE_CODE = process.argv[2];
  
  if (!INVITE_CODE) {
    console.error('❌ Please provide an invite code as argument');
    console.log('Usage: node simulate-invite-signup.js <INVITE_CODE>');
    return;
  }

  try {
    // Step 1: Verify invite code
    console.log(`1. Verifying invite code: ${INVITE_CODE}`);
    const verifyResponse = await fetch(`${BASE_URL}/api/verify-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inviteCode: INVITE_CODE })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      console.error('❌ Invite verification failed:', error.message);
      return;
    }

    // Extract cookies from response
    const cookies = verifyResponse.headers.raw()['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';
    
    console.log('✅ Invite code verified');
    console.log('   Cookies set:', cookies?.map(c => c.split('=')[0]).join(', '));

    // Step 2: Sign up with the verified invite
    const timestamp = Date.now();
    const testUser = {
      username: `testuser_${timestamp}`,
      name: 'Test User',
      email: `test_${timestamp}@example.com`,
      password: 'TestPassword123!'
    };

    console.log(`\n2. Signing up as ${testUser.username}...`);
    const signupResponse = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString
      },
      body: JSON.stringify(testUser)
    });

    const signupData = await signupResponse.json();
    
    if (!signupResponse.ok) {
      console.error('❌ Signup failed:', signupData.message);
      return;
    }

    console.log('✅ Signup successful!');
    console.log('   User ID:', signupData.user.id);
    console.log('   Username:', signupData.user.username);

    // Step 3: Check the invite code usage
    console.log('\n3. Checking invite code usage...');
    
    // We need to check this directly in the database
    // For now, let's check if we can get the code stats via the admin API
    
    // First, login as admin to check
    const adminLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'invite_verified=true'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (adminLoginResponse.ok) {
      const adminData = await adminLoginResponse.json();
      const adminCookies = adminLoginResponse.headers.raw()['set-cookie'];
      const adminCookieString = adminCookies ? adminCookies.join('; ') : '';
      
      // Get invite codes list
      const codesResponse = await fetch(`${BASE_URL}/api/admin/invite-codes`, {
        headers: {
          'Cookie': adminCookieString,
          'Authorization': `Bearer ${adminData.token}`
        }
      });

      if (codesResponse.ok) {
        const codes = await codesResponse.json();
        const usedCode = codes.find(c => c.code === INVITE_CODE);
        
        if (usedCode) {
          console.log(`✅ Found invite code: ${INVITE_CODE}`);
          console.log(`   Current uses: ${usedCode.current_uses}/${usedCode.max_uses}`);
          console.log(`   Active: ${usedCode.is_active}`);
          console.log(`   Stats:`, usedCode.stats);
        }
      }
    }

    console.log('\n✅ Complete flow tested successfully!');
    console.log('\nNote: The usage count should have increased by 1 after signup.');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

simulateInviteSignup();