const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Single shared admin account
const adminAccounts = [
  {
    email: 'admin@argos.ai',
    username: 'admin',
    name: 'Admin',
    role: 'admin',
    password: 'admin123'
  }
];

async function provisionAdminAccounts() {
  console.log('Starting admin account provisioning...');

  for (const admin of adminAccounts) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', admin.email)
        .single();

      if (existingUser) {
        if (existingUser.role !== 'admin') {
          // Update existing user to admin role
          const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'admin' })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error(`Error updating ${admin.email} to admin:`, updateError);
          } else {
            console.log(`Updated ${admin.email} to admin role`);
          }
        } else {
          console.log(`${admin.email} is already an admin`);
        }
      } else {
        // Create new admin user
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email: admin.email,
            username: admin.username,
            name: admin.name,
            role: 'admin',
            password_hash: hashedPassword,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error creating admin ${admin.email}:`, insertError);
        } else {
          console.log(`Created admin account for ${admin.email}`);
          console.log(`Initial password: ${admin.password}`);
          console.log('⚠️  Please change this password immediately after first login!');
        }
      }
    } catch (error) {
      console.error(`Error processing ${admin.email}:`, error);
    }
  }

  console.log('\nAdmin account provisioning complete!');
  console.log('\nShared admin credentials:');
  console.log('Username: admin');
  console.log('Password: admin123');
  console.log('\nBoth Alex and Stelios can use these credentials to access admin features.');
}

// Run the provisioning
provisionAdminAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });