const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function resetAdminPassword() {
  console.log('\n🔐 Resetting Admin Password\n');
  
  try {
    // 1. Check if admin exists
    console.log('1. Checking admin user...');
    const { data: adminUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .single();
    
    if (error || !adminUser) {
      console.error('❌ Admin user not found!');
      
      // Create admin user if doesn't exist
      console.log('\n2. Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          email: 'admin@argos.ai',
          username: 'admin',
          name: 'Admin',
          role: 'admin',
          password_hash: hashedPassword,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating admin:', createError);
        return;
      }
      
      console.log('✅ Admin user created!');
    } else {
      console.log('Admin user found:', {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
        is_active: adminUser.is_active
      });
      
      // 2. Reset password
      console.log('\n2. Resetting password...');
      const newHash = await bcrypt.hash('admin123', 10);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('username', 'admin');
      
      if (updateError) {
        console.error('Update error:', updateError);
        return;
      }
      
      console.log('✅ Password reset successful!');
    }
    
    console.log('\n✅ Admin credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

resetAdminPassword();