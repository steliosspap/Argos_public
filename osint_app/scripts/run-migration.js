const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('🔧 Running Phase 2 database migration...');
  
  try {
    // Add escalation_score column
    console.log('Adding escalation_score column...');
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE news ADD COLUMN IF NOT EXISTS escalation_score INTEGER DEFAULT 0;'
    });
    
    // Add country column  
    console.log('Adding country column...');
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE news ADD COLUMN IF NOT EXISTS country TEXT;'
    });
    
    // Add region column (might already exist)
    console.log('Adding region column...');
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE news ADD COLUMN IF NOT EXISTS region TEXT;'
    });
    
    // Create indexes
    console.log('Creating indexes...');
    await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_news_escalation_score ON news(escalation_score);'
    });
    
    await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_news_country ON news(country);'
    });
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('📝 Please run the SQL commands manually in Supabase SQL Editor:');
    console.log(`
ALTER TABLE news ADD COLUMN IF NOT EXISTS escalation_score INTEGER DEFAULT 0;
ALTER TABLE news ADD COLUMN IF NOT EXISTS country TEXT;  
ALTER TABLE news ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS idx_news_escalation_score ON news(escalation_score);
CREATE INDEX IF NOT EXISTS idx_news_country ON news(country);
    `);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };