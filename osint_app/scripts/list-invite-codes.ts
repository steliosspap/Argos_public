import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listInviteCodes() {
  try {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('code, is_multi_use, max_uses, used_count, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invite codes:', error);
      return;
    }

    console.log('\n🔑 Active Invite Codes:\n');
    console.log('Code        | Type        | Uses (Used/Max) | Created');
    console.log('------------|-------------|-----------------|------------------');
    
    data?.forEach(code => {
      const type = code.is_multi_use ? 'Multi-use' : 'Single-use';
      const uses = code.is_multi_use ? `${code.used_count}/${code.max_uses}` : `${code.used_count}/1`;
      const created = new Date(code.created_at).toLocaleString();
      
      console.log(`${code.code.padEnd(11)} | ${type.padEnd(11)} | ${uses.padEnd(15)} | ${created}`);
    });

    console.log('\n✅ Total codes:', data?.length || 0);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

listInviteCodes();