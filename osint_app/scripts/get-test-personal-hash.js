require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getHash() {
  const { data, error } = await supabase
    .from('users')
    .select('username, password_hash')
    .eq('username', 'test_personal')
    .single();
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Username:', data.username);
  console.log('Password hash:', data.password_hash);
}

getHash();