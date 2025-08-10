const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking invite-related database tables...\n');

  // 1. Check users table structure
  console.log('1. Checking users table...');
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (!error && user) {
      console.log('✅ users table exists');
      console.log('   Sample columns:', Object.keys(user[0] || {}).join(', '));
      console.log('   Has invite_code_id column:', 'invite_code_id' in (user[0] || {}));
    }
  } catch (err) {
    console.error('❌ Error checking users table:', err.message);
  }

  // 2. Check invite_codes table
  console.log('\n2. Checking invite_codes table...');
  try {
    const { data: code, error } = await supabase
      .from('invite_codes')
      .select('*')
      .limit(1);
    
    if (!error && code) {
      console.log('✅ invite_codes table exists');
      console.log('   Sample columns:', Object.keys(code[0] || {}).join(', '));
    }
  } catch (err) {
    console.error('❌ Error checking invite_codes table:', err.message);
  }

  // 3. Check invite_redemptions table
  console.log('\n3. Checking invite_redemptions table...');
  try {
    const { data: redemption, error } = await supabase
      .from('invite_redemptions')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ invite_redemptions table does not exist');
        console.log('   This table needs to be created for proper tracking');
      } else {
        console.error('❌ Error:', error.message);
      }
    } else {
      console.log('✅ invite_redemptions table exists');
      if (redemption && redemption.length > 0) {
        console.log('   Sample columns:', Object.keys(redemption[0]).join(', '));
      }
    }
  } catch (err) {
    console.error('❌ Error checking invite_redemptions table:', err.message);
  }

  // 4. Check invite_verifications table
  console.log('\n4. Checking invite_verifications table...');
  try {
    const { data: verification, error } = await supabase
      .from('invite_verifications')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ invite_verifications table does not exist');
        console.log('   This table is used by verify-invite endpoint');
      } else {
        console.error('❌ Error:', error.message);
      }
    } else {
      console.log('✅ invite_verifications table exists');
    }
  } catch (err) {
    console.error('❌ Error checking invite_verifications table:', err.message);
  }

  // 5. Test creating a user with invite code
  console.log('\n5. Testing user creation with invite code...');
  try {
    // First get a valid invite code
    const { data: codes } = await supabase
      .from('invite_codes')
      .select('id, code')
      .eq('is_active', true)
      .limit(1);
    
    if (codes && codes.length > 0) {
      const testCode = codes[0];
      console.log(`   Using code: ${testCode.code}`);
      
      // Check if we can update a user with invite_code_id
      const testUsername = 'test_' + Date.now();
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          username: testUsername,
          email: testUsername + '@test.com',
          name: 'Test User',
          password_hash: 'dummy_hash',
          invite_code_id: testCode.id
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Failed to create test user:', createError.message);
        if (createError.message.includes('invite_code_id')) {
          console.log('   ⚠️  The users table might not have an invite_code_id column');
        }
      } else {
        console.log('✅ Successfully created user with invite_code_id');
        
        // Clean up
        await supabase
          .from('users')
          .delete()
          .eq('id', newUser.id);
        console.log('   Cleaned up test user');
      }
    }
  } catch (err) {
    console.error('❌ Error testing user creation:', err.message);
  }

  console.log('\n✅ Check completed!');
}

checkTables();