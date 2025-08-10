import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generateInitialCodes() {
  console.log('Generating initial invite codes...');
  
  // Generate 10 single-use codes for initial beta users
  const codes = [];
  
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase.rpc('generate_invite_code', {
      p_length: 8,
      p_created_by: null,
      p_max_uses: 1,
      p_expires_in_days: 90,
      p_metadata: {
        type: 'initial_beta',
        batch: 'launch',
        generated_by_script: true
      }
    });
    
    if (error) {
      console.error('Failed to generate code:', error);
    } else {
      codes.push(data);
      console.log(`Generated code: ${data}`);
    }
  }
  
  // Generate 5 multi-use codes for testing (3 uses each)
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase.rpc('generate_invite_code', {
      p_length: 8,
      p_created_by: null,
      p_max_uses: 3,
      p_expires_in_days: 30,
      p_metadata: {
        type: 'test_multiuse',
        batch: 'launch',
        generated_by_script: true
      }
    });
    
    if (error) {
      console.error('Failed to generate multi-use code:', error);
    } else {
      codes.push(data);
      console.log(`Generated multi-use code: ${data} (3 uses)`);
    }
  }
  
  console.log('\n=== INVITE CODES GENERATED ===');
  console.log('Single-use codes (first 10):');
  codes.slice(0, 10).forEach(code => console.log(`  ${code}`));
  console.log('\nMulti-use codes (last 5):');
  codes.slice(10).forEach(code => console.log(`  ${code} (3 uses)`));
  console.log('\nTotal codes generated:', codes.length);
}

// Run the script
generateInitialCodes()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });