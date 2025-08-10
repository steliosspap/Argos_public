/**
 * Authentication middleware for the Argos project
 * Backend API Agent - Authentication & Authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { APIError, ErrorCodes } from './errors';
import { APIContext } from './middleware';

export interface AuthenticatedContext extends APIContext {
  user: {
    id: string;
    email: string;
    role?: string;
    aud: string;
    exp: number;
  };
  supabase: ReturnType<typeof createServerClient>;
}

/**
 * Middleware to require authentication for protected routes
 */
export function withAuth<T = any>(
  handler: (context: AuthenticatedContext) => Promise<T>
): (request: NextRequest, params?: any) => Promise<NextResponse> {
  return async (request: NextRequest, params?: any) => {
    try {
      const cookieStore = cookies();
      
      // First try to get JWT token from cookie or header
      const authToken = cookieStore.get('authToken')?.value || 
                       request.headers.get('authorization')?.replace('Bearer ', '');
      
      if (!authToken) {
        throw new APIError(
          401,
          'Authentication required',
          ErrorCodes.UNAUTHORIZED
        );
      }
      
      // Verify JWT token
      const jwt = await import('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new APIError(
          500,
          'JWT_SECRET environment variable is required',
          ErrorCodes.INTERNAL_ERROR
        );
      }
      const decoded = jwt.default.verify(authToken, JWT_SECRET) as any;
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new APIError(
          401,
          'Token expired',
          ErrorCodes.UNAUTHORIZED
        );
      }
      
      // Create supabase client for database operations
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
          },
        }
      );

      // Create authenticated context
      const authenticatedContext: AuthenticatedContext = {
        request,
        params,
        user: {
          id: decoded.id,
          email: decoded.email || '',
          role: decoded.role || 'user',
          aud: 'authenticated',
          exp: decoded.exp || 0,
        },
        supabase,
      };

      const result = await handler(authenticatedContext);
      return NextResponse.json(result);
    } catch (error: any) {
      if (error instanceof APIError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            details: error.details,
          },
          { status: error.statusCode }
        );
      }
      
      const message = error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError'
        ? 'Invalid or expired token'
        : 'Authentication service error';
        
      return NextResponse.json(
        {
          error: message,
          code: ErrorCodes.INTERNAL_ERROR,
          details: { originalError: error.message },
        },
        { status: error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' ? 401 : 500 }
      );
    }
  };
}

/**
 * Middleware to require specific roles for protected routes
 */
export function withRole<T = any>(
  requiredRole: string | string[],
  handler: (context: AuthenticatedContext) => Promise<T>
): (request: NextRequest, params?: any) => Promise<NextResponse> {
  return withAuth(async (context: AuthenticatedContext) => {
    const userRole = context.user.role || 'user';
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!allowedRoles.includes(userRole)) {
      throw new APIError(
        403,
        `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        ErrorCodes.FORBIDDEN,
        { userRole, requiredRoles: allowedRoles }
      );
    }

    return await handler(context);
  });
}

/**
 * Middleware for admin-only routes
 */
export function withAdminRole<T = any>(
  handler: (context: AuthenticatedContext) => Promise<T>
): (request: NextRequest, params?: any) => Promise<NextResponse> {
  return withRole('admin', handler);
}

/**
 * Middleware for optional authentication (user context if available)
 */
export function withOptionalAuth<T = any>(
  handler: (context: APIContext | AuthenticatedContext) => Promise<T>
): (request: NextRequest, params?: any) => Promise<NextResponse> {
  return async (request: NextRequest, params?: any) => {
    const cookieStore = cookies();
    
    // Try to get JWT token from cookie or header
    const authToken = cookieStore.get('authToken')?.value || 
                     request.headers.get('authorization')?.replace('Bearer ', '');
    
    // Create supabase client for database operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    let context: APIContext | AuthenticatedContext = {
      request,
      params,
    };
    
    if (authToken) {
      try {
        // Verify JWT token
        const jwt = await import('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
          console.warn('JWT_SECRET environment variable is required for optional auth');
          return;
        }
        const decoded = jwt.default.verify(authToken, JWT_SECRET) as any;
        
        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp > now) {
          context = {
            request,
            params,
            user: {
              id: decoded.id,
              email: decoded.email || '',
              role: decoded.role || 'user',
              aud: 'authenticated',
              exp: decoded.exp || 0,
            },
            supabase,
          } as AuthenticatedContext;
        }
      } catch (error) {
        // Silently continue without authentication for optional auth
        console.warn('Optional auth failed:', error);
      }
    }

    try {
      const result = await handler(context);
      return NextResponse.json(result);
    } catch (error: any) {
      if (error instanceof APIError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            details: error.details,
          },
          { status: error.statusCode }
        );
      }
      
      return NextResponse.json(
        {
          error: 'Internal server error',
          code: ErrorCodes.INTERNAL_ERROR,
          details: { originalError: error.message },
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Utility function to check if user has permission for resource
 */
export function hasResourcePermission(
  user: AuthenticatedContext['user'],
  resourceOwnerId?: string,
  requiredRole?: string
): boolean {
  // Admin can access everything
  if (user.role === 'admin') {
    return true;
  }

  // Check specific role requirement
  if (requiredRole && user.role !== requiredRole) {
    return false;
  }

  // Check resource ownership
  if (resourceOwnerId && user.id !== resourceOwnerId) {
    return false;
  }

  return true;
}

/**
 * Middleware to protect resource-specific routes
 */
export function withResourceAuth<T = any>(
  getResourceOwnerId: (context: APIContext) => Promise<string | null>,
  handler: (context: AuthenticatedContext) => Promise<T>
): (request: NextRequest, params?: any) => Promise<NextResponse> {
  return withAuth(async (context: AuthenticatedContext) => {
    const resourceOwnerId = await getResourceOwnerId(context);
    
    if (!hasResourcePermission(context.user, resourceOwnerId || undefined)) {
      throw new APIError(
        403,
        'Access denied to this resource',
        ErrorCodes.FORBIDDEN,
        { resourceOwnerId }
      );
    }

    return await handler(context);
  });
}