import { createClient } from '@supabase/supabase-js';

// Function to get admin client - lazy initialization to avoid build errors
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// For backward compatibility - this will be called at runtime, not build time
export const supabaseAdmin = typeof window === 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? getSupabaseAdmin()
  : null as any;