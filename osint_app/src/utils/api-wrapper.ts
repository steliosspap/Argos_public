import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { SAFARI_CONFIG, isProduction } from '@/config/safari';

// Detect Safari from request
function isSafariRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  return /^((?!chrome|android).)*safari/i.test(userAgent);
}

// Production-safe API wrapper
export function withApiHandler(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const startTime = Date.now();
    const isSafari = isSafariRequest(request);
    
    try {
      // Log request in production for Safari
      if (isSafari || !isProduction()) {
        console.log(`[API] ${request.method} ${request.nextUrl.pathname}`, {
          safari: isSafari,
          auth: request.headers.get('authorization') ? 'present' : 'missing',
          contentType: request.headers.get('content-type'),
        });
      }
      
      // Call the actual handler
      const response = await handler(request);
      
      // Ensure response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        // Clone response and ensure it's JSON
        const body = await response.text();
        let jsonBody;
        
        try {
          jsonBody = JSON.parse(body);
        } catch {
          // Body is not JSON, wrap it
          jsonBody = { 
            data: body,
            warning: 'Response was not JSON and has been wrapped'
          };
        }
        
        // Create new response with JSON
        const jsonResponse = NextResponse.json(jsonBody, {
          status: response.status,
          statusText: response.statusText,
        });
        
        // Copy headers
        response.headers.forEach((value, key) => {
          jsonResponse.headers.set(key, value);
        });
        
        // Add Safari headers
        if (isSafari) {
          Object.entries(SAFARI_CONFIG.responseHeaders).forEach(([key, value]) => {
            jsonResponse.headers.set(key, value);
          });
        }
        
        return jsonResponse;
      }
      
      // Add Safari-specific headers
      if (isSafari) {
        Object.entries(SAFARI_CONFIG.responseHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      
      // Log response time
      const duration = Date.now() - startTime;
      if (duration > 1000 || !isProduction()) {
        console.log(`[API] Response time: ${duration}ms`, {
          path: request.nextUrl.pathname,
          status: response.status,
        });
      }
      
      return response;
      
    } catch (error) {
      // Log error
      console.error(`[API Error] ${request.nextUrl.pathname}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        safari: isSafari,
      });
      
      // Return JSON error response
      const errorResponse = {
        error: true,
        message: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        path: request.nextUrl.pathname,
        ...(isProduction() ? {} : { stack: error instanceof Error ? error.stack : undefined })
      };
      
      const response = NextResponse.json(errorResponse, { status: 500 });
      
      // Add Safari headers
      if (isSafari) {
        Object.entries(SAFARI_CONFIG.responseHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      
      return response;
    }
  };
}

// OPTIONS handler for preflight requests
export function withOptionsHandler(
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
) {
  return async (request: NextRequest) => {
    const headersList = headers();
    const origin = headersList.get('origin') || '*';
    
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': allowedMethods.join(', '),
        'Access-Control-Allow-Headers': SAFARI_CONFIG.cors.allowedHeaders.join(', '),
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  };
}