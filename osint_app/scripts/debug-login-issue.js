const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugLoginIssue() {
  console.log('\n🔍 Debugging Login Issues - Personal vs Admin Accounts\n');
  
  try {
    // 1. List all users and their roles
    console.log('1. Fetching all users from custom users table...\n');
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, username, email, role, is_active, password_hash')
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return;
    }
    
    console.log('Found users:');
    for (const user of allUsers) {
      console.log(`- Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role || 'user'}`);
      console.log(`  Active: ${user.is_active}`);
      console.log(`  Has password hash: ${!!user.password_hash} (length: ${user.password_hash?.length || 0})`);
      console.log('');
    }
    
    // 2. Check for admin users
    console.log('\n2. Admin users:');
    const adminUsers = allUsers.filter(u => u.role === 'admin');
    if (adminUsers.length === 0) {
      console.log('❌ No admin users found!');
    } else {
      adminUsers.forEach(admin => {
        console.log(`- ${admin.username} (${admin.email})`);
      });
    }
    
    // 3. Check for personal (non-admin) users
    console.log('\n3. Personal users:');
    const personalUsers = allUsers.filter(u => u.role !== 'admin');
    if (personalUsers.length === 0) {
      console.log('❌ No personal users found!');
    } else {
      personalUsers.forEach(user => {
        console.log(`- ${user.username} (${user.email}) - Role: ${user.role || 'user'}`);
      });
    }
    
    // 4. Test password hashes
    console.log('\n4. Testing password hashes...\n');
    const testPasswords = ['TestPassword123', 'YourNewPassword123', 'password', 'admin123'];
    
    for (const user of allUsers.slice(0, 3)) { // Test first 3 users
      console.log(`Testing user: ${user.username}`);
      if (!user.password_hash) {
        console.log('  ❌ No password hash found!');
        continue;
      }
      
      let passwordFound = false;
      for (const testPass of testPasswords) {
        const isValid = await bcrypt.compare(testPass, user.password_hash);
        if (isValid) {
          console.log(`  ✅ Password match: "${testPass}"`);
          passwordFound = true;
          break;
        }
      }
      
      if (!passwordFound) {
        console.log('  ❌ No matching password found in test set');
      }
      console.log('');
    }
    
    // 5. Create test users with known passwords
    console.log('\n5. Creating test users with known passwords...\n');
    
    // Create admin test user
    const adminPassword = 'AdminTest123';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'testadmin')
      .single();
    
    if (!existingAdmin) {
      const { error: adminError } = await supabase
        .from('users')
        .insert({
          username: 'testadmin',
          email: 'testadmin@example.com',
          name: 'Test Admin',
          password_hash: adminHash,
          role: 'admin',
          is_active: true
        });
      
      if (adminError) {
        console.log('❌ Failed to create admin user:', adminError.message);
      } else {
        console.log('✅ Created test admin user:');
        console.log('   Username: testadmin');
        console.log('   Password: AdminTest123');
        console.log('   Role: admin');
      }
    } else {
      console.log('Test admin user already exists');
    }
    
    // Create personal test user
    const personalPassword = 'PersonalTest123';
    const personalHash = await bcrypt.hash(personalPassword, 10);
    
    const { data: existingPersonal } = await supabase
      .from('users')
      .select('id')
      .eq('username', 'testpersonal')
      .single();
    
    if (!existingPersonal) {
      const { error: personalError } = await supabase
        .from('users')
        .insert({
          username: 'testpersonal',
          email: 'testpersonal@example.com',
          name: 'Test Personal',
          password_hash: personalHash,
          role: 'user',
          is_active: true
        });
      
      if (personalError) {
        console.log('❌ Failed to create personal user:', personalError.message);
      } else {
        console.log('\n✅ Created test personal user:');
        console.log('   Username: testpersonal');
        console.log('   Password: PersonalTest123');
        console.log('   Role: user');
      }
    } else {
      console.log('Test personal user already exists');
    }
    
    // 6. Check for any differences in password hash format
    console.log('\n6. Analyzing password hash formats...\n');
    const hashAnalysis = {};
    
    for (const user of allUsers) {
      if (user.password_hash) {
        const hashPrefix = user.password_hash.substring(0, 7);
        const role = user.role || 'user';
        
        if (!hashAnalysis[role]) {
          hashAnalysis[role] = {};
        }
        
        if (!hashAnalysis[role][hashPrefix]) {
          hashAnalysis[role][hashPrefix] = 0;
        }
        
        hashAnalysis[role][hashPrefix]++;
      }
    }
    
    console.log('Password hash prefixes by role:');
    for (const [role, prefixes] of Object.entries(hashAnalysis)) {
      console.log(`\n${role} users:`);
      for (const [prefix, count] of Object.entries(prefixes)) {
        console.log(`  ${prefix}... : ${count} users`);
      }
    }
    
    // 7. Test actual login function
    console.log('\n7. Testing login endpoint...\n');
    console.log('To test the login endpoint, use these curl commands:\n');
    
    console.log('For admin user:');
    console.log(`curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "testadmin", "password": "AdminTest123"}'`);
    
    console.log('\nFor personal user:');
    console.log(`curl -X POST http://localhost:3000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "testpersonal", "password": "PersonalTest123"}'`);
    
    console.log('\n\n📋 Summary:');
    console.log('- Total users:', allUsers.length);
    console.log('- Admin users:', adminUsers.length);
    console.log('- Personal users:', personalUsers.length);
    console.log('- Users without password hash:', allUsers.filter(u => !u.password_hash).length);
    console.log('- Inactive users:', allUsers.filter(u => !u.is_active).length);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

debugLoginIssue();