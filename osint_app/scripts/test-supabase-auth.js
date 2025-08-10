const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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

async function testAuth() {
  console.log('Testing Supabase Auth...');
  console.log('Supabase URL:', supabaseUrl);
  
  try {
    // List users (requires service role key)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
    } else {
      console.log(`\nFound ${users.length} users:`);
      users.forEach(user => {
        console.log(`- ${user.email} (ID: ${user.id})`);
      });
    }
    
    // Test password reset for a specific email
    const testEmail = 'steliospapageorgiou88@gmail.com';
    console.log(`\nTesting password reset for: ${testEmail}`);
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: 'http://localhost:3000/reset-password',
    });
    
    if (error) {
      console.error('Password reset error:', error);
    } else {
      console.log('Password reset response:', data);
      console.log('✅ Password reset email request sent successfully!');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testAuth();