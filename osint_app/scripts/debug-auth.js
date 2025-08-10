const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugAuth() {
  const email = 'steliospapageorgiou88@gmail.com';
  const testPassword = 'YourNewPassword123';
  
  console.log('\n🔍 Debugging Authentication Issues\n');
  
  try {
    // 1. Check custom users table
    console.log('1. Checking custom users table...');
    const { data: customUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return;
    }
    
    console.log('User found:', {
      id: customUser.id,
      username: customUser.username,
      email: customUser.email,
      has_password_hash: !!customUser.password_hash,
      password_hash_length: customUser.password_hash?.length
    });
    
    // 2. Test password hash
    console.log('\n2. Testing password hash...');
    if (customUser.password_hash) {
      const isValid = await bcrypt.compare(testPassword, customUser.password_hash);
      console.log(`Password "YourNewPassword123" is valid: ${isValid}`);
      
      // Test with a wrong password to ensure bcrypt works
      const wrongTest = await bcrypt.compare('wrongpassword', customUser.password_hash);
      console.log(`Password "wrongpassword" is valid: ${wrongTest} (should be false)`);
    }
    
    // 3. Check Supabase Auth
    console.log('\n3. Checking Supabase Auth...');
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);
    
    if (authUser) {
      console.log('Auth user found:', {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at
      });
    } else {
      console.log('❌ No user found in Supabase Auth');
    }
    
    // 4. Test login with username
    console.log('\n4. What happens during login?');
    console.log('Login expects:');
    console.log('- Username field (not email): "stelios"');
    console.log('- Password field: your password');
    console.log('\nThe login API checks:');
    console.log('- Looks up user by username in custom users table');
    console.log('- Compares password with password_hash using bcrypt');
    
    // 5. Let's manually create a new hash to test
    console.log('\n5. Creating a fresh password hash for testing...');
    const newHash = await bcrypt.hash('TestPassword123', 10);
    console.log('New hash created for "TestPassword123"');
    
    // Update the user with this new hash
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: newHash,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);
    
    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('✅ Password updated! You can now login with:');
      console.log('   Username: stelios');
      console.log('   Password: TestPassword123');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugAuth();