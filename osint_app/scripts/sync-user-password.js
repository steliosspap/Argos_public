const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function syncUserPassword() {
  const email = 'steliospapageorgiou88@gmail.com';
  const newPassword = process.argv[2]; // Pass password as command line argument
  
  if (!newPassword) {
    console.error('Please provide a password as an argument');
    console.log('Usage: node sync-user-password.js <new-password>');
    process.exit(1);
  }

  console.log(`\n🔄 Syncing password for user: ${email}`);
  
  try {
    // 1. Check if user exists in custom users table
    const { data: customUser, error: customError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (customError || !customUser) {
      console.error('❌ User not found in custom users table');
      console.log('\nLet\'s check what users exist:');
      
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, email, username');
      
      console.log('Users in custom table:', allUsers);
      return;
    }
    
    console.log('✅ Found user in custom table:', {
      id: customUser.id,
      username: customUser.username,
      email: customUser.email
    });
    
    // 2. Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed');
    
    // 3. Update the password in custom users table
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);
    
    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return;
    }
    
    console.log('✅ Password updated in custom users table');
    
    // 4. Also update in Supabase Auth
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.users.find(u => u.email === email);
    
    if (authUser) {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        authUser.id,
        { password: newPassword }
      );
      
      if (authError) {
        console.error('❌ Error updating Supabase Auth:', authError);
      } else {
        console.log('✅ Password also updated in Supabase Auth');
      }
    }
    
    console.log('\n🎉 Password sync complete!');
    console.log(`You can now login with username: ${customUser.username} and your new password`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

syncUserPassword();