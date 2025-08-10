require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPersonalAccount(username) {
  console.log(`\n🔍 Testing account: ${username}`);
  
  try {
    // Fetch user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error) {
      console.error('❌ Error fetching user:', error);
      return;
    }
    
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    
    console.log('✅ User found:');
    console.log('   - ID:', user.id);
    console.log('   - Username:', user.username);
    console.log('   - Email:', user.email);
    console.log('   - Role:', user.role);
    console.log('   - Active:', user.is_active);
    console.log('   - Has password hash:', !!user.password_hash);
    console.log('   - Password hash length:', user.password_hash?.length);
    console.log('   - Password hash format:', user.password_hash?.substring(0, 7));
    
    // Try to verify a test password
    if (user.password_hash) {
      const testPasswords = ['admin123', 'password', 'password123', username];
      console.log('\n🔐 Testing common passwords...');
      
      for (const testPass of testPasswords) {
        const match = await bcrypt.compare(testPass, user.password_hash);
        if (match) {
          console.log(`   ✅ Password "${testPass}" matches!`);
          break;
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

async function main() {
  console.log('🔍 PERSONAL ACCOUNT LOGIN DEBUGGING\n');
  
  // Test some personal accounts
  const personalAccounts = [
    'Maria',
    'stelios',
    'chmorris',
    'test_personal'
  ];
  
  for (const account of personalAccounts) {
    await testPersonalAccount(account);
  }
  
  // Also test admin for comparison
  console.log('\n📊 Admin account for comparison:');
  await testPersonalAccount('admin');
}

main().catch(console.error);