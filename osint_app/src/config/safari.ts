// Safari-specific configuration for production
export const SAFARI_CONFIG = {
  // Force these headers on all API responses
  responseHeaders: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  },
  
  // CORS configuration
  cors: {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma'
    ],
    exposedHeaders: [
      'Content-Length',
      'Content-Range',
      'X-Total-Count'
    ]
  },
  
  // Request timeout for Safari (in ms)
  requestTimeout: 30000,
  
  // Retry configuration
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoff: 2
  }
};

// Helper to check if running in production
export const isProduction = () => process.env.NODE_ENV === 'production';

// Helper to get safe environment variables
export const getEnvVar = (key: string, fallback?: string): string => {
  // During build time, environment variables might not be available
  if (typeof process === 'undefined' || !process.env) {
    if (!isProduction()) {
      console.warn(`[Safari Config] process.env not available for ${key}`);
    }
    return fallback || '';
  }
  
  const value = process.env[key];
  if (!value && !fallback && !isProduction()) {
    console.warn(`[Safari Config] Missing environment variable: ${key}`);
  }
  
  return value || fallback || '';
};

// Production-safe Supabase configuration
export const getSupabaseConfig = () => {
  const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  if (!url || !anonKey) {
    console.error('[Safari Config] Missing Supabase configuration');
    return null;
  }
  
  return { url, anonKey };
};