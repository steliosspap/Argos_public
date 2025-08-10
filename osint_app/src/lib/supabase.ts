import { createClient } from '@supabase/supabase-js';

// Get environment variables with fallback for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if environment variables are available
if (!supabaseUrl || !supabaseKey) {
  if (typeof window !== 'undefined') {
    console.error('[Supabase] Missing environment variables!');
    console.error('[Supabase] NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!supabaseKey);
  }
}

// Log initialization (only in development and on client)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  console.log('[Supabase] Initializing with URL:', supabaseUrl);
  console.log('[Supabase] Anon key present:', !!supabaseKey);
}

// Create client with error handling and Safari-compatible settings
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? {
          getItem: (key: string) => {
            try {
              return localStorage.getItem(key);
            } catch {
              return null;
            }
          },
          setItem: (key: string, value: string) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              console.warn('[Supabase] Failed to save to localStorage');
            }
          },
          removeItem: (key: string) => {
            try {
              localStorage.removeItem(key);
            } catch {
              console.warn('[Supabase] Failed to remove from localStorage');
            }
          }
        } : undefined
      },
      global: {
        headers: {
          'X-Client-Info': 'argos-osint'
        }
      }
    })
  : null as any;

// Types that match our database schema
export interface DatabaseConflict {
  id: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  conflict_type: string;
  status: string;
  description: string;
  casualties?: number;
  start_date: string;
  updated_at: string;
  escalation_score?: number;
}

export interface DatabaseArmsDeal {
  id: string;
  date: string;
  buyer_country: string;
  seller_country?: string;
  seller_company?: string;
  weapon_system: string;
  deal_value: number;
  currency: string;
  source_link?: string;
  description?: string;
  status: string;
}

export interface DatabaseNewsItem {
  id: string;
  headline: string;
  source: string;
  region?: string;
  date: string;
  url?: string;
  summary?: string;
  tags: string[];
}