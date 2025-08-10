import { NextResponse } from 'next/server';

interface ApiResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  isSafari?: boolean;
}

// Ensure all API responses are properly formatted JSON
export function apiResponse<T = any>(
  data: T,
  options: ApiResponseOptions = {}
): NextResponse {
  const { status = 200, headers = {}, isSafari = false } = options;
  
  // Ensure data is serializable
  let responseData: any;
  try {
    // Test if data is serializable
    JSON.stringify(data);
    responseData = data;
  } catch (e) {
    console.error('[API Response] Data is not serializable:', e);
    responseData = {
      error: 'Internal server error',
      message: 'Response data could not be serialized',
    };
  }
  
  // Build headers
  const responseHeaders = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  
  // Add Safari-specific headers
  if (isSafari) {
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
  }
  
  return NextResponse.json(responseData, {
    status,
    headers: responseHeaders,
  });
}

// Error response helper
export function apiError(
  message: string,
  status: number = 500,
  details?: any,
  isSafari: boolean = false
): NextResponse {
  const errorData = {
    error: true,
    message,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
  };
  
  return apiResponse(errorData, { status, isSafari });
}

// Success response helper
export function apiSuccess<T = any>(
  data: T,
  meta?: any,
  isSafari: boolean = false
): NextResponse {
  const responseData = {
    success: true,
    data,
    ...(meta && { meta }),
    timestamp: new Date().toISOString(),
  };
  
  return apiResponse(responseData, { status: 200, isSafari });
}