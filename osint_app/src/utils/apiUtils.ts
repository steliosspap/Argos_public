import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Enhanced error types for better error handling
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  timestamp: string;
  retryable: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: Error) => boolean;
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: (error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.name === 'NetworkError' || error.name === 'TimeoutError') return true;
    if ('status' in error) {
      const status = (error as any).status;
      return status >= 500 || status === 408 || status === 429;
    }
    return false;
  }
};

// Enhanced error handling utility
export function createApiError(
  message: string, 
  originalError?: Error | any,
  retryable: boolean = false
): ApiError {
  const error: ApiError = {
    message,
    timestamp: new Date().toISOString(),
    retryable
  };

  if (originalError) {
    if ('code' in originalError) error.code = originalError.code;
    if ('status' in originalError) error.status = originalError.status;
    
    // Enhance retryability based on error details
    if (originalError.status >= 500 || originalError.status === 408 || originalError.status === 429) {
      error.retryable = true;
    }
  }

  return error;
}

// Exponential backoff with jitter
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
    config.maxDelay
  );
  
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  return Math.floor(delay + jitter);
}

// Generic retry wrapper with enhanced error handling
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName?: string
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry if it wasn't the first attempt
      if (attempt > 1 && operationName) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry if this is the last attempt
      if (attempt === finalConfig.maxAttempts) {
        break;
      }

      // Check if error is retryable
      const shouldRetry = finalConfig.retryCondition ? 
        finalConfig.retryCondition(lastError) : 
        true;

      if (!shouldRetry) {
        console.warn(`❌ ${operationName || 'Operation'} failed with non-retryable error:`, lastError.message);
        throw createApiError(
          lastError.message,
          lastError,
          false
        );
      }

      const delay = calculateDelay(attempt, finalConfig);
      console.warn(`⚠️ ${operationName || 'Operation'} failed on attempt ${attempt}/${finalConfig.maxAttempts}. Retrying in ${delay}ms...`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All attempts failed
  console.error(`❌ ${operationName || 'Operation'} failed after ${finalConfig.maxAttempts} attempts:`, lastError!.message);
  throw createApiError(
    `Operation failed after ${finalConfig.maxAttempts} attempts: ${lastError!.message}`,
    lastError!,
    false
  );
}

// Supabase query wrapper with retry logic
export async function supabaseQueryWithRetry<T>(
  queryBuilder: () => any,
  operationName: string = 'Supabase query'
): Promise<T> {
  return withRetry(
    async () => {
      const { data, error } = await queryBuilder();
      
      if (error) {
        throw createApiError(
          error.message,
          error,
          error.code !== 'PGRST116' // PGRST116 is "not found", not retryable
        );
      }

      if (!data) {
        throw createApiError('No data received', undefined, true);
      }

      return data;
    },
    {
      maxAttempts: 3,
      retryCondition: (error) => {
        // Don't retry auth errors or client errors (400-499)
        if ('status' in error) {
          const status = (error as any).status;
          return status >= 500 || status === 408 || status === 429;
        }
        return true;
      }
    },
    operationName
  );
}

// Request timeout wrapper
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  operationName?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName || 'Operation'} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

// Enhanced fetch wrapper with retry and timeout
export async function enhancedFetch(
  url: string,
  options: RequestInit = {},
  config: {
    timeout?: number;
    retryConfig?: Partial<RetryConfig>;
    operationName?: string;
  } = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retryConfig = {},
    operationName = `Fetch ${url}`
  } = config;

  return withRetry(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw createApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            { status: response.status },
            response.status >= 500 || response.status === 408 || response.status === 429
          );
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw createApiError(`Request timed out after ${timeout}ms`, error, true);
        }
        
        throw error;
      }
    },
    retryConfig,
    operationName
  );
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(operationName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operationName, duration);
    };
  }

  recordMetric(operationName: string, duration: number): void {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    const metrics = this.metrics.get(operationName)!;
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Log slow operations
    if (duration > 1000) {
      console.warn(`🐌 Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`);
    }
  }

  getMetrics(operationName: string): { avg: number; min: number; max: number; count: number } | null {
    const metrics = this.metrics.get(operationName);
    if (!metrics || metrics.length === 0) return null;

    const avg = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);

    return { avg, min, max, count: metrics.length };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    
    for (const [operationName] of this.metrics) {
      const metrics = this.getMetrics(operationName);
      if (metrics) {
        result[operationName] = metrics;
      }
    }

    return result;
  }

  logPerformanceReport(): void {
    const allMetrics = this.getAllMetrics();
    console.group('📊 Performance Report');
    
    Object.entries(allMetrics).forEach(([operation, metrics]) => {
      console.log(`${operation}: avg=${metrics.avg.toFixed(2)}ms, min=${metrics.min.toFixed(2)}ms, max=${metrics.max.toFixed(2)}ms, count=${metrics.count}`);
    });
    
    console.groupEnd();
  }
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Remove duplicate debounce - it's already defined above

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, delay);
    }
  };
}