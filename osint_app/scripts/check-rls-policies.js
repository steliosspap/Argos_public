const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRLS() {
  console.log('🔍 Checking RLS policies and testing direct update...\n');
  
  try {
    // Test direct update with service role key
    console.log('1. Testing direct update with service role key...');
    
    // Get a code
    const { data: codes } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('code', 'TESTCIYK')
      .single();
    
    if (!codes) {
      console.log('❌ Code TESTCIYK not found');
      return;
    }
    
    console.log(`Found code: ${codes.code}, current uses: ${codes.current_uses}`);
    
    // Try to update it
    const { data: updated, error: updateError } = await supabase
      .from('invite_codes')
      .update({ 
        current_uses: codes.current_uses + 1 
      })
      .eq('id', codes.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Update failed:', updateError);
      console.log('\nThis suggests RLS policies might be blocking updates.');
    } else {
      console.log('✅ Update successful!');
      console.log(`   New usage count: ${updated.current_uses}`);
      
      // Reset it back
      await supabase
        .from('invite_codes')
        .update({ current_uses: codes.current_uses })
        .eq('id', codes.id);
      console.log('   (Reset back to original value)');
    }
    
    // Check if RLS is enabled
    console.log('\n2. Checking if RLS is enabled on invite_codes table...');
    console.log('   Note: Cannot check RLS status via API, but if updates work with');
    console.log('   service role key, then RLS is not the issue.');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

checkRLS();