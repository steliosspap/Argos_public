#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addUserPreferencesColumns() {
  try {
    console.log('Adding user preferences columns to users table...');

    // Add preferences column as JSONB to store all preferences
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
          "emailNotifications": true,
          "pushNotifications": false,
          "newsAlerts": true,
          "escalationAlerts": true,
          "refreshInterval": "5",
          "theme": "dark",
          "language": "en",
          "timezone": "UTC",
          "mapStyle": "satellite",
          "autoPlayVideos": false,
          "showEventLabels": true,
          "soundAlerts": false
        }'::jsonb;
      `
    });

    if (addColumnError) {
      console.error('Error adding preferences column:', addColumnError);
      
      // Try alternative approach
      console.log('Trying alternative approach...');
      const { error: alterError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (alterError) {
        console.error('Cannot access users table:', alterError);
        console.log('\nPlease run this SQL manually in your Supabase dashboard:');
        console.log(`
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "emailNotifications": true,
  "pushNotifications": false,
  "newsAlerts": true,
  "escalationAlerts": true,
  "refreshInterval": "5",
  "theme": "dark",
  "language": "en",
  "timezone": "UTC",
  "mapStyle": "satellite",
  "autoPlayVideos": false,
  "showEventLabels": true,
  "soundAlerts": false
}'::jsonb;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);
        `);
      } else {
        console.log('\nThe users table exists but cannot be altered via API.');
        console.log('Please run the SQL above in your Supabase dashboard.');
      }
      return;
    }

    console.log('✅ Successfully added preferences column to users table');

    // Create index for better performance
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);`
    });

    if (indexError) {
      console.log('Could not create index (may require manual creation):', indexError.message);
    } else {
      console.log('✅ Created preferences index');
    }

  } catch (error) {
    console.error('Error:', error);
    console.log('\nPlease run this SQL manually in your Supabase dashboard:');
    console.log(`
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{
  "emailNotifications": true,
  "pushNotifications": false,
  "newsAlerts": true,
  "escalationAlerts": true,
  "refreshInterval": "5",
  "theme": "dark",
  "language": "en",
  "timezone": "UTC",
  "mapStyle": "satellite",
  "autoPlayVideos": false,
  "showEventLabels": true,
  "soundAlerts": false
}'::jsonb;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_preferences ON users USING GIN (preferences);
    `);
  }
}

// Run the migration
addUserPreferencesColumns();