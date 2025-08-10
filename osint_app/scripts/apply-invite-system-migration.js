const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/004_add_invite_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying invite system migration...');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        console.log(`\nExecuting: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('execute_sql', {
          sql: statement + ';'
        }).catch(async (rpcError) => {
          // If RPC doesn't exist, try direct execution (not recommended for production)
          console.log('RPC not available, statement skipped');
          return { error: 'RPC not available' };
        });

        if (error) {
          console.error(`❌ Error: ${error}`);
          errorCount++;
        } else {
          console.log('✅ Success');
          successCount++;
        }
      } catch (err) {
        console.error(`❌ Error executing statement: ${err.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);

    // Test if the invite_codes table exists
    console.log('\n🔍 Testing invite_codes table...');
    const { data, error } = await supabase
      .from('invite_codes')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ invite_codes table test failed:', error.message);
      console.log('\n⚠️  The migration needs to be applied manually through the Supabase dashboard.');
      console.log('📋 Copy the SQL from: database/migrations/004_add_invite_system.sql');
      console.log('🔗 Go to: https://supabase.com/dashboard/project/dduximhdfknhxjnpnigu/sql/new');
    } else {
      console.log('✅ invite_codes table exists and is accessible!');
    }

  } catch (error) {
    console.error('Fatal error:', error);
  }
}

applyMigration();