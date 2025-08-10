#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function applyEscalationSchema() {
  console.log('🔧 Applying escalation score schema update to Supabase...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/news-table-escalation-update.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL Migration Content:');
    console.log(sqlContent);
    console.log('\n📊 Executing schema update...\n');

    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sqlContent 
    });

    if (error) {
      console.error('❌ Schema update failed:', error);
      
      // Try individual statements if batch failed
      console.log('\n🔄 Attempting individual statement execution...\n');
      
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      let successCount = 0;
      let failureCount = 0;

      for (const statement of statements) {
        try {
          console.log(`Executing: ${statement.substring(0, 80)}...`);
          
          const { error: stmtError } = await supabase.rpc('exec_sql', { 
            query: statement 
          });
          
          if (stmtError) {
            console.error(`❌ Failed: ${stmtError.message}`);
            failureCount++;
          } else {
            console.log('✅ Success');
            successCount++;
          }
        } catch (stmtErr) {
          console.error(`❌ Exception: ${stmtErr.message}`);
          failureCount++;
        }
      }

      console.log(`\n📊 Individual execution results: ${successCount} success, ${failureCount} failures`);
      
    } else {
      console.log('✅ Schema update executed successfully');
      console.log('📄 Result:', data);
    }

    // Verify the schema update worked
    console.log('\n🔍 Verifying schema update...\n');
    
    // Check if escalation_score column exists
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'news')
      .eq('column_name', 'escalation_score');

    if (columnError) {
      console.error('❌ Error checking column:', columnError);
    } else if (columns && columns.length > 0) {
      console.log('✅ escalation_score column verified:');
      console.log(`   Type: ${columns[0].data_type}`);
      console.log(`   Nullable: ${columns[0].is_nullable}`);
    } else {
      console.log('⚠️ escalation_score column not found - schema update may have failed');
    }

    // Check if views were created
    const { data: views, error: viewError } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .in('table_name', ['high_escalation_news', 'news_escalation_analytics']);

    if (viewError) {
      console.error('❌ Error checking views:', viewError);
    } else {
      console.log(`✅ Created views: ${views.map(v => v.table_name).join(', ')}`);
    }

    // Check indexes
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('tablename', 'news')
      .like('indexname', '%escalation%');

    if (indexError) {
      console.error('❌ Error checking indexes:', indexError);
    } else {
      console.log(`✅ Created indexes: ${indexes.map(i => i.indexname).join(', ')}`);
    }

  } catch (error) {
    console.error('💥 Schema update failed:', error);
    process.exit(1);
  }
}

// Run the schema update
applyEscalationSchema()
  .then(() => {
    console.log('\n🎉 Escalation score schema update completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema update failed:', error);
    process.exit(1);
  });