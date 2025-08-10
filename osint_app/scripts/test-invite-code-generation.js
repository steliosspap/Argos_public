const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateRandomCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

async function testInviteCodeGeneration() {
  try {
    console.log('🔍 Testing invite code generation...\n');

    // Test 1: Check if table exists
    console.log('1. Checking if invite_codes table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('invite_codes')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Table check failed:', tableError.message);
      console.log('\n⚠️  The invite_codes table might not exist. Please run the migration first.');
      return;
    }
    console.log('✅ Table exists\n');

    // Test 2: Try to generate a code using RPC
    console.log('2. Testing RPC function generate_invite_code...');
    const { data: rpcCode, error: rpcError } = await supabase.rpc('generate_invite_code', {
      p_length: 8,
      p_created_by: null,
      p_max_uses: 1,
      p_expires_in_days: 30,
      p_metadata: { test: true }
    });

    if (rpcError) {
      console.log('⚠️  RPC function not available:', rpcError.message);
      console.log('   Falling back to manual generation...\n');
    } else {
      console.log('✅ RPC function works! Generated code:', rpcCode, '\n');
    }

    // Test 3: Manual code generation
    console.log('3. Testing manual code generation...');
    const testCode = generateRandomCode(8);
    console.log('   Generated code:', testCode);

    // Check if code already exists
    const { data: existing } = await supabase
      .from('invite_codes')
      .select('id')
      .eq('code', testCode)
      .single();

    if (existing) {
      console.log('⚠️  Code already exists, generating another...');
      const testCode2 = generateRandomCode(8);
      console.log('   New code:', testCode2);
    }

    // Test 4: Insert a code manually
    console.log('\n4. Testing manual code insertion...');
    const manualCode = 'TEST' + generateRandomCode(4);
    const { data: insertData, error: insertError } = await supabase
      .from('invite_codes')
      .insert({
        code: manualCode,
        created_by: null,
        max_uses: 5,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { 
          test: true, 
          created_via: 'test_script',
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert failed:', insertError.message);
    } else {
      console.log('✅ Successfully inserted code:', insertData.code);
      console.log('   Code details:', {
        id: insertData.id,
        code: insertData.code,
        max_uses: insertData.max_uses,
        expires_at: insertData.expires_at
      });
    }

    // Test 5: List all codes
    console.log('\n5. Listing all invite codes...');
    const { data: allCodes, error: listError } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (listError) {
      console.error('❌ List failed:', listError.message);
    } else {
      console.log(`✅ Found ${allCodes.length} invite codes:`);
      allCodes.forEach(code => {
        console.log(`   - ${code.code} (uses: ${code.current_uses}/${code.max_uses}, active: ${code.is_active})`);
      });
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testInviteCodeGeneration();