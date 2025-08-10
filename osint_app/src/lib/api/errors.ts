/**
 * Standardized API error handling for the Argos project
 * Backend API Agent - Error Management Module
 */

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const ErrorCodes = {
  // Client errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Business logic errors
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface APIErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
  };
}

export function createErrorResponse(
  error: APIError,
  path?: string
): APIErrorResponse {
  return {
    error: {
      code: (error.code as ErrorCode) || ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}

export function handleAPIError(error: unknown, path?: string): {
  status: number;
  body: APIErrorResponse;
} {
  if (error instanceof APIError) {
    return {
      status: error.statusCode,
      body: createErrorResponse(error, path),
    };
  }

  // Handle Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as any;
    if (supabaseError.code === '23505') {
      return {
        status: 409,
        body: createErrorResponse(
          new APIError(409, 'Duplicate entry', ErrorCodes.DUPLICATE_ENTRY, {
            constraint: supabaseError.details,
          }),
          path
        ),
      };
    }
  }

  // Default error handling
  console.error('Unhandled error:', error);
  return {
    status: 500,
    body: createErrorResponse(
      new APIError(
        500,
        'An unexpected error occurred',
        ErrorCodes.INTERNAL_ERROR
      ),
      path
    ),
  };
}