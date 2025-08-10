const fetch = require('node-fetch');

async function testLogin(username, password, description) {
  console.log(`\n🔐 Testing login for ${description}:`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${password}`);
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Response: ${responseText}`);
      return;
    }
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`   ✅ Login successful!`);
      console.log(`   Message: ${data.message}`);
      if (data.user) {
        console.log(`   User ID: ${data.user.id}`);
        console.log(`   Username: ${data.user.username}`);
        console.log(`   Email: ${data.user.email}`);
      }
      if (data.token) {
        // Decode JWT to see the payload
        const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString());
        console.log(`   Token Role: ${payload.role || 'user'}`);
        console.log(`   Token Expires: ${new Date(payload.exp * 1000).toLocaleString()}`);
      }
    } else {
      console.log(`   ❌ Login failed!`);
      console.log(`   Error: ${data.message || data.error}`);
      if (data.details) {
        console.log(`   Details:`, data.details);
      }
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Testing Login API Endpoint\n');
  console.log('Make sure the Next.js app is running on http://localhost:3000\n');
  
  // Test various accounts
  await testLogin('testadmin', 'AdminTest123', 'Test Admin Account');
  await testLogin('testpersonal', 'PersonalTest123', 'Test Personal Account');
  await testLogin('stelios', 'TestPassword123', 'Stelios Account (if password was updated)');
  await testLogin('admin', 'admin123', 'Common Admin Credentials');
  await testLogin('wronguser', 'wrongpass', 'Invalid Credentials');
  
  console.log('\n\n📋 Analysis:');
  console.log('If admin accounts work but personal accounts fail with "Invalid credentials",');
  console.log('the issue is likely one of the following:\n');
  console.log('1. Password hashes are corrupted or in wrong format for personal accounts');
  console.log('2. There\'s a role-based check somewhere that\'s not obvious');
  console.log('3. The database query is filtering out non-admin users');
  console.log('4. The is_active flag might be false for personal accounts');
  
  console.log('\n💡 Next steps:');
  console.log('1. Run the debug-login-issue.js script to analyze the database');
  console.log('2. Check the server logs when attempting to login');
  console.log('3. Verify password hashes are being created correctly');
}

// Check if node-fetch is installed
try {
  require.resolve('node-fetch');
  runTests();
} catch(e) {
  console.log('Please install node-fetch first:');
  console.log('npm install node-fetch@2');
}