const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInviteUsage() {
  try {
    console.log('🔍 Testing invite code usage tracking...\n');

    // 1. First, let's check current invite codes
    console.log('1. Checking current invite codes...');
    const { data: codes, error: fetchError } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error('❌ Failed to fetch codes:', fetchError);
      return;
    }

    console.log('Recent invite codes:');
    codes.forEach(code => {
      console.log(`  - ${code.code}: ${code.current_uses}/${code.max_uses} uses, active: ${code.is_active}`);
    });

    // 2. Check invite_redemptions table
    console.log('\n2. Checking invite redemptions...');
    const { data: redemptions, error: redemptionError } = await supabase
      .from('invite_redemptions')
      .select('*, invite_codes(code), users(username)')
      .order('redeemed_at', { ascending: false })
      .limit(10);

    if (redemptionError) {
      console.error('❌ Failed to fetch redemptions:', redemptionError);
      // Table might not exist
      console.log('   Note: invite_redemptions table might not exist');
    } else if (redemptions && redemptions.length > 0) {
      console.log('Recent redemptions:');
      redemptions.forEach(r => {
        console.log(`  - Code: ${r.invite_codes?.code || r.invite_code_id}, User: ${r.users?.username || r.user_id}, Date: ${new Date(r.redeemed_at).toLocaleString()}`);
      });
    } else {
      console.log('   No redemptions found');
    }

    // 3. Check users table for invite_code_id references
    console.log('\n3. Checking users with invite codes...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('username, invite_code_id, created_at')
      .not('invite_code_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (usersError) {
      console.error('❌ Failed to fetch users:', usersError);
    } else if (users && users.length > 0) {
      console.log('Recent users with invite codes:');
      for (const user of users) {
        // Get the invite code details
        const { data: code } = await supabase
          .from('invite_codes')
          .select('code')
          .eq('id', user.invite_code_id)
          .single();
        
        console.log(`  - ${user.username}: Used code ${code?.code || user.invite_code_id}, Joined: ${new Date(user.created_at).toLocaleDateString()}`);
      }
    } else {
      console.log('   No users found with invite codes');
    }

    // 4. Test the complete flow
    console.log('\n4. Testing complete invite flow...');
    
    // Create a test invite code
    const testCode = 'TEST' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data: newCode, error: createError } = await supabase
      .from('invite_codes')
      .insert({
        code: testCode,
        max_uses: 5,
        current_uses: 0,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Failed to create test code:', createError);
      return;
    }

    console.log(`✅ Created test code: ${testCode}`);
    console.log(`   Initial uses: ${newCode.current_uses}/${newCode.max_uses}`);

    // Simulate usage by updating the count
    const { error: updateError } = await supabase
      .from('invite_codes')
      .update({ current_uses: newCode.current_uses + 1 })
      .eq('id', newCode.id);

    if (updateError) {
      console.error('❌ Failed to update usage:', updateError);
    } else {
      console.log('✅ Simulated usage increment');
      
      // Verify the update
      const { data: updatedCode } = await supabase
        .from('invite_codes')
        .select('current_uses')
        .eq('id', newCode.id)
        .single();
      
      console.log(`   Updated uses: ${updatedCode.current_uses}/${newCode.max_uses}`);
    }

    // Clean up test code
    await supabase
      .from('invite_codes')
      .delete()
      .eq('id', newCode.id);
    
    console.log('✅ Cleaned up test code');

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testInviteUsage();