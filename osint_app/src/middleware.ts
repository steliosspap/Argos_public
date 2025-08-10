import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Completely public paths - no invite or auth needed
const publicPaths = [
  '/invite',
  '/api/verify-invite',
  '/about',  // About page is fully public
  '/_next',
  '/favicon.ico',
  '/images',
  '/fonts',
  '/sw.js',
  '/serviceWorker.js',
  '/manifest.json',
  '/.well-known',
  '/offline.html',
  '/argos-logo.png',
  '/script.js',
];

// Paths accessible with invite code but without authentication
const inviteOnlyPaths = [
  '/',  // Landing page
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

// Auth API routes - always accessible (no invite needed)
const authApiPaths = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/update-password-hash',
  '/api/auth/webhook',
];

// Helper to detect Safari
function isSafariBrowser(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isIOSSafari = /iPad|iPhone|iPod/.test(userAgent) && !/CriOS/.test(userAgent);
  return isSafari || isIOSSafari;
}

// Helper to handle CORS for API routes
function handleCorsForApiRoutes(request: NextRequest, isSafari: boolean): NextResponse {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Safari fix: Ensure JSON content type for API responses
  if (isSafari) {
    requestHeaders.set('Accept', 'application/json');
  }
  
  // Create response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Get origin for CORS
  const origin = request.headers.get('origin') || '*';
  
  // Add CORS headers with Safari-specific handling
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  // Safari-specific headers
  response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, X-Total-Count');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(JSON.stringify({ ok: true }), { 
      status: 200, 
      headers: response.headers 
    });
  }
  
  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent');
  const isSafari = isSafariBrowser(userAgent);
  
  // 1. Check if completely public path (no invite or auth needed)
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/') || pathname.startsWith(path + '.')
  );
  
  if (isPublicPath) {
    if (pathname.startsWith('/api/')) {
      return handleCorsForApiRoutes(request, isSafari);
    }
    return NextResponse.next();
  }
  
  // 2. Check if auth API path (always accessible)
  const isAuthApiPath = authApiPaths.some(path => pathname === path);
  
  if (isAuthApiPath) {
    return handleCorsForApiRoutes(request, isSafari);
  }
  
  // 3. Check invite verification
  const inviteVerified = request.cookies.get('invite_verified')?.value;
  
  // If no invite, redirect to invite page
  if (!inviteVerified) {
    // Handle service worker
    if (request.headers.get('service-worker') || request.headers.get('sec-fetch-dest') === 'serviceworker') {
      return NextResponse.next();
    }
    
    const response = NextResponse.redirect(new URL('/invite', request.url));
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return response;
  }
  
  // 4. User has invite - check if path only needs invite (not auth)
  const isInviteOnlyPath = inviteOnlyPaths.some(path => pathname === path);
  
  if (isInviteOnlyPath) {
    return NextResponse.next();
  }
  
  // 5. All other paths require authentication
  const token = request.cookies.get('authToken')?.value || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    // No token, redirect to login
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // For API routes, let them handle auth and return 401
  }
  
  // Log API requests in development
  const shouldLog = process.env.NODE_ENV === 'development' || 
                   (isSafari && pathname.startsWith('/api/'));
  
  if (shouldLog && pathname.startsWith('/api/')) {
    console.log(`[Middleware] ${request.method} ${pathname}`, {
      isSafari,
      origin: request.headers.get('origin'),
      auth: request.headers.get('authorization') ? 'Present' : 'Missing',
      contentType: request.headers.get('content-type'),
      env: process.env.NODE_ENV,
    });
  }
  
  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    return handleCorsForApiRoutes(request, isSafari);
  }
  
  return NextResponse.next();
}

// Error handler middleware
export async function onError(error: Error, request: NextRequest) {
  const userAgent = request.headers.get('user-agent');
  const isSafari = isSafariBrowser(userAgent);
  
  console.error(`[Middleware Error] ${request.method} ${request.url}`, {
    error: error.message,
    isSafari,
    headers: {
      authorization: request.headers.get('authorization') ? 'Present' : 'Missing',
      contentType: request.headers.get('content-type'),
      accept: request.headers.get('accept'),
    }
  });
  
  // Return a JSON error response for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: error.message,
        path: request.nextUrl.pathname,
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};