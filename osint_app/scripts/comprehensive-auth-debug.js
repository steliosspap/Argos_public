const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function comprehensiveDebug() {
  console.log('\n🔍 COMPREHENSIVE AUTH DEBUGGING\n');
  console.log('='.repeat(50));
  
  try {
    // 1. Check RLS policies on users table
    console.log('\n1. Checking RLS policies on users table...');
    const { data: policies, error: policyError } = await supabase
      .rpc('pg_policies')
      .eq('tablename', 'users');
    
    if (policyError) {
      console.log('Could not fetch RLS policies (this is normal if the function doesn\'t exist)');
    } else if (policies && policies.length > 0) {
      console.log('RLS Policies found:');
      policies.forEach(p => {
        console.log(`- ${p.policyname}: ${p.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}`);
      });
    }
    
    // 2. Test direct query to users table
    console.log('\n2. Testing direct query to users table...');
    const { data: allUsers, error: queryError } = await supabase
      .from('users')
      .select('id, username, email, role, is_active, created_at')
      .order('created_at', { ascending: false });
    
    if (queryError) {
      console.error('❌ Error querying users table:', queryError.message);
      console.error('Details:', queryError);
    } else {
      console.log(`✅ Successfully queried users table. Found ${allUsers.length} users:`);
      allUsers.forEach(user => {
        console.log(`   - ${user.username} (${user.email}) - Role: ${user.role || 'user'}, Active: ${user.is_active}`);
      });
    }
    
    // 3. Create test users with different roles
    console.log('\n3. Creating/updating test users...');
    
    // Test user data
    const testUsers = [
      {
        username: 'test_admin',
        email: 'test_admin@example.com',
        name: 'Test Admin User',
        password: 'TestAdmin123!',
        role: 'admin'
      },
      {
        username: 'test_personal',
        email: 'test_personal@example.com',
        name: 'Test Personal User',
        password: 'TestPersonal123!',
        role: 'user'
      },
      {
        username: 'test_premium',
        email: 'test_premium@example.com',
        name: 'Test Premium User',
        password: 'TestPremium123!',
        role: 'premium'
      }
    ];
    
    for (const testUser of testUsers) {
      // Hash password
      const passwordHash = await bcrypt.hash(testUser.password, 10);
      
      // Check if user exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', testUser.username)
        .single();
      
      if (existing) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            password_hash: passwordHash,
            is_active: true,
            role: testUser.role,
            updated_at: new Date().toISOString()
          })
          .eq('username', testUser.username);
        
        if (updateError) {
          console.log(`   ❌ Failed to update ${testUser.username}:`, updateError.message);
        } else {
          console.log(`   ✅ Updated ${testUser.username} (${testUser.role})`);
        }
      } else {
        // Create new user
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            username: testUser.username,
            email: testUser.email,
            name: testUser.name,
            password_hash: passwordHash,
            role: testUser.role,
            is_active: true
          });
        
        if (insertError) {
          console.log(`   ❌ Failed to create ${testUser.username}:`, insertError.message);
        } else {
          console.log(`   ✅ Created ${testUser.username} (${testUser.role})`);
        }
      }
    }
    
    // 4. Test password verification for each user
    console.log('\n4. Testing password verification...');
    
    for (const testUser of testUsers) {
      const { data: user, error } = await supabase
        .from('users')
        .select('password_hash')
        .eq('username', testUser.username)
        .single();
      
      if (error || !user) {
        console.log(`   ❌ Could not fetch ${testUser.username}`);
        continue;
      }
      
      const isValid = await bcrypt.compare(testUser.password, user.password_hash);
      console.log(`   ${testUser.username}: Password valid = ${isValid}`);
    }
    
    // 5. Simulate the exact login query
    console.log('\n5. Simulating login queries...');
    
    for (const testUser of testUsers) {
      console.log(`\n   Testing login for ${testUser.username}:`);
      
      // This is the exact query from the login route
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('id, username, email, name, password_hash, is_active, role')
        .eq('username', testUser.username)
        .single();
      
      if (fetchError) {
        console.log(`   ❌ Query failed:`, fetchError.message);
        continue;
      }
      
      if (!user) {
        console.log(`   ❌ No user found`);
        continue;
      }
      
      console.log(`   ✅ User found:`, {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        has_password_hash: !!user.password_hash
      });
      
      // Check if user is active
      if (!user.is_active) {
        console.log(`   ❌ User is not active!`);
        continue;
      }
      
      // Verify password
      const passwordMatch = await bcrypt.compare(testUser.password, user.password_hash);
      console.log(`   Password match: ${passwordMatch}`);
    }
    
    // 6. Check for any unusual patterns
    console.log('\n6. Analyzing patterns...');
    
    const { data: analysis } = await supabase
      .from('users')
      .select('role, is_active, password_hash');
    
    if (analysis) {
      const stats = {
        total: analysis.length,
        byRole: {},
        inactive: 0,
        noPasswordHash: 0
      };
      
      analysis.forEach(user => {
        const role = user.role || 'user';
        stats.byRole[role] = (stats.byRole[role] || 0) + 1;
        if (!user.is_active) stats.inactive++;
        if (!user.password_hash) stats.noPasswordHash++;
      });
      
      console.log('\n   Database statistics:');
      console.log(`   - Total users: ${stats.total}`);
      console.log(`   - By role:`, stats.byRole);
      console.log(`   - Inactive users: ${stats.inactive}`);
      console.log(`   - Users without password hash: ${stats.noPasswordHash}`);
    }
    
    // 7. Test with curl commands
    console.log('\n7. Test commands:\n');
    console.log('Test these curl commands while the Next.js app is running:\n');
    
    testUsers.forEach(user => {
      console.log(`# Test ${user.role} user:`);
      console.log(`curl -X POST http://localhost:3000/api/auth/login \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"username": "${user.username}", "password": "${user.password}"}'`);
      console.log('');
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('\n📋 SUMMARY:\n');
    console.log('If personal accounts fail but admin accounts work:');
    console.log('1. Check server logs for any middleware blocking non-admin users');
    console.log('2. Verify the is_active flag is true for all users');
    console.log('3. Ensure password hashes are in correct bcrypt format');
    console.log('4. Check if there are any additional auth checks in the frontend');
    console.log('\nThe test users created above should help isolate the issue.');
    
  } catch (err) {
    console.error('\n❌ Unexpected error:', err);
  }
}

comprehensiveDebug();