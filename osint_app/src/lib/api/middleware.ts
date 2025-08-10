/**
 * API Middleware for the Argos project
 * Backend API Agent - Request/Response Pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { APIError, handleAPIError, APIErrorResponse } from './errors';
import { ZodSchema, ZodError } from 'zod';

export interface APIContext {
  request: NextRequest;
  params?: any;
  user?: any; // Will be populated by auth middleware
}

export type APIHandler<T = any> = (
  context: APIContext
) => Promise<NextResponse<T | APIErrorResponse>>;

/**
 * Wraps API handlers with error handling and common middleware
 */
export function withErrorHandling<T = any>(
  handler: APIHandler<T>
): APIHandler<T> {
  return async (context: APIContext) => {
    try {
      return await handler(context);
    } catch (error) {
      const { status, body } = handleAPIError(
        error,
        context.request.nextUrl.pathname
      );
      return NextResponse.json(body, { status });
    }
  };
}

/**
 * Validates request body against a Zod schema
 */
export function withValidation<T = any>(
  schema: ZodSchema,
  handler: APIHandler<T>
): APIHandler<T> {
  return async (context: APIContext) => {
    try {
      const body = await context.request.json();
      const validated = schema.parse(body);
      
      // Add validated body to context
      const enhancedContext = {
        ...context,
        body: validated,
      };
      
      return await handler(enhancedContext);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new APIError(400, 'Validation error', 'VALIDATION_ERROR', {
          errors: error.errors,
        });
      }
      throw error;
    }
  };
}

/**
 * Validates query parameters against a Zod schema
 */
export function withQueryValidation<T = any>(
  schema: ZodSchema,
  handler: APIHandler<T>
): APIHandler<T> {
  return async (context: APIContext) => {
    try {
      const searchParams = context.request.nextUrl.searchParams;
      const query: Record<string, any> = {};
      
      searchParams.forEach((value, key) => {
        // Handle array parameters (e.g., ?tags=a&tags=b)
        if (query[key]) {
          if (Array.isArray(query[key])) {
            query[key].push(value);
          } else {
            query[key] = [query[key], value];
          }
        } else {
          query[key] = value;
        }
      });
      
      const validated = schema.parse(query);
      
      // Add validated query to context
      const enhancedContext = {
        ...context,
        query: validated,
      };
      
      return await handler(enhancedContext);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new APIError(400, 'Invalid query parameters', 'VALIDATION_ERROR', {
          errors: error.errors,
        });
      }
      throw error;
    }
  };
}

/**
 * Adds CORS headers to responses
 */
export function withCORS<T = any>(
  handler: APIHandler<T>,
  options?: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
  }
): APIHandler<T> {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
  } = options || {};

  return async (context: APIContext) => {
    // Handle preflight requests
    if (context.request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': Array.isArray(origin)
            ? origin.join(',')
            : origin,
          'Access-Control-Allow-Methods': methods.join(','),
          'Access-Control-Allow-Headers': headers.join(','),
        },
      });
    }

    const response = await handler(context);
    
    // Add CORS headers to response
    response.headers.set(
      'Access-Control-Allow-Origin',
      Array.isArray(origin) ? origin.join(',') : origin
    );
    
    return response;
  };
}

/**
 * Combines multiple middleware functions
 */
export function composeMiddleware<T = any>(
  ...middlewares: Array<(handler: APIHandler<T>) => APIHandler<T>>
): (handler: APIHandler<T>) => APIHandler<T> {
  return (handler: APIHandler<T>) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    );
  };
}

/**
 * Standard API response helpers
 */
export function successResponse<T>(
  data: T,
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  }
): NextResponse {
  return NextResponse.json({
    data,
    meta,
    timestamp: new Date().toISOString(),
  });
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): NextResponse {
  return successResponse(data, {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  });
}