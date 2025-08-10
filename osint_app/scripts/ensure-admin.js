const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureAdminExists() {
  try {
    // Check if admin user already exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', 'admin')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows returned, which is fine
      console.error('Error checking for admin user:', checkError);
      return;
    }

    if (existingAdmin) {
      console.log('Admin user already exists');
      
      // Update password to ensure it's always admin123
      const passwordHash = await bcrypt.hash('admin123', 10);
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: passwordHash,
          role: 'admin',
          is_active: true
        })
        .eq('id', existingAdmin.id);

      if (updateError) {
        console.error('Error updating admin password:', updateError);
      } else {
        console.log('Admin password updated successfully');
      }
      return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    const { data: newAdmin, error: insertError } = await supabase
      .from('users')
      .insert({
        username: 'admin',
        email: 'admin@argos.ai',
        name: 'System Administrator',
        password_hash: passwordHash,
        role: 'admin',
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating admin user:', insertError);
      return;
    }

    console.log('Admin user created successfully:', {
      username: newAdmin.username,
      email: newAdmin.email,
      role: newAdmin.role
    });

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the function
ensureAdminExists();