const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdminUser() {
  console.log('Checking for admin user...\n');

  try {
    // Check if admin user exists
    const { data: adminUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .single();

    if (error) {
      console.error('Error fetching admin user:', error);
      return;
    }

    if (adminUser) {
      console.log('Admin user found:');
      console.log('ID:', adminUser.id);
      console.log('Username:', adminUser.username);
      console.log('Email:', adminUser.email);
      console.log('Role:', adminUser.role);
      console.log('Active:', adminUser.is_active);
      console.log('Created:', adminUser.created_at);
      
      if (adminUser.role !== 'admin') {
        console.log('\n⚠️  WARNING: User exists but does not have admin role!');
        console.log('Updating user role to admin...');
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ role: 'admin' })
          .eq('id', adminUser.id);
          
        if (updateError) {
          console.error('Failed to update role:', updateError);
        } else {
          console.log('✅ User role updated to admin successfully!');
        }
      } else {
        console.log('\n✅ User has admin role');
      }
    } else {
      console.log('❌ Admin user not found');
    }
    
    // Also check all users with admin role
    console.log('\n\nAll users with admin role:');
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id, username, email, role')
      .eq('role', 'admin');
      
    if (adminUsers && adminUsers.length > 0) {
      console.table(adminUsers);
    } else {
      console.log('No users with admin role found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAdminUser();