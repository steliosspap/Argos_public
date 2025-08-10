import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTable() {
  try {
    // Just get all invite codes
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .limit(20);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Invite codes in database:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTable();