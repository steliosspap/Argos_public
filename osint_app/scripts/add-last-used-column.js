const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addLastUsedColumn() {
  try {
    console.log('🔧 Adding last_used_at column to invite_codes table...\n');

    // First, check if the column already exists
    const { data: existingCode, error: checkError } = await supabase
      .from('invite_codes')
      .select('*')
      .limit(1);

    if (checkError) {
      console.error('❌ Error checking table:', checkError);
      return;
    }

    if (existingCode && existingCode.length > 0) {
      const hasLastUsed = 'last_used_at' in existingCode[0];
      
      if (hasLastUsed) {
        console.log('✅ last_used_at column already exists');
        return;
      }
    }

    // Add the column using raw SQL
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE invite_codes 
        ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
      `
    });

    if (alterError) {
      // If RPC doesn't exist, we can't add the column programmatically
      console.log('⚠️  Cannot add column programmatically. Please run this SQL manually:');
      console.log('\n```sql');
      console.log('ALTER TABLE invite_codes');
      console.log('ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;');
      console.log('```\n');
    } else {
      console.log('✅ Successfully added last_used_at column');
    }

    // Test by updating a code
    const { data: codes } = await supabase
      .from('invite_codes')
      .select('id')
      .limit(1);

    if (codes && codes.length > 0) {
      const { error: updateError } = await supabase
        .from('invite_codes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', codes[0].id);

      if (!updateError) {
        console.log('✅ Successfully tested updating last_used_at');
      } else if (updateError.message.includes('last_used_at')) {
        console.log('❌ Column not available. Please add it manually.');
      }
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

addLastUsedColumn();