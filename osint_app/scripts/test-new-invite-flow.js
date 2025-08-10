const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testNewInviteFlow() {
  console.log('🔍 Testing new invite flow where usage is tracked on verification...\n');
  
  try {
    // Step 1: Create a new test invite code
    const testCode = 'SITE' + Math.random().toString(36).substring(2, 6).toUpperCase();
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

    // Step 2: Verify the invite code (simulating site access)
    console.log('\n2. Verifying invite code (accessing site)...');
    const verifyResponse = await fetch('http://localhost:3000/api/verify-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inviteCode: testCode })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      console.error('❌ Verification failed:', error.message);
      return;
    }

    console.log('✅ Invite code verified (site access granted)');

    // Step 3: Check the updated usage count
    const { data: updatedCode, error: fetchError } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('id', newCode.id)
      .single();

    if (fetchError) {
      console.error('❌ Failed to fetch updated code:', fetchError);
      return;
    }

    console.log(`\n3. Updated invite code stats:`);
    console.log(`   Code: ${updatedCode.code}`);
    console.log(`   Uses: ${updatedCode.current_uses}/${updatedCode.max_uses} (increased by 1)`);
    console.log(`   Active: ${updatedCode.is_active}`);
    console.log(`   Last used: ${updatedCode.last_used_at || 'Not tracked yet'}`);

    // Step 4: Simulate multiple uses
    console.log('\n4. Simulating multiple uses...');
    for (let i = 2; i <= 5; i++) {
      const response = await fetch('http://localhost:3000/api/verify-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: testCode })
      });

      if (response.ok) {
        console.log(`   Use #${i}: ✅ Success`);
      } else {
        const error = await response.json();
        console.log(`   Use #${i}: ❌ ${error.message}`);
      }
    }

    // Step 5: Check final state
    const { data: finalCode } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('id', newCode.id)
      .single();

    console.log(`\n5. Final invite code state:`);
    console.log(`   Uses: ${finalCode.current_uses}/${finalCode.max_uses}`);
    console.log(`   Active: ${finalCode.is_active} (should be false if max uses reached)`);

    // Cleanup
    await supabase
      .from('invite_codes')
      .delete()
      .eq('id', newCode.id);
    
    console.log('\n✅ Test completed and cleaned up!');

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testNewInviteFlow();