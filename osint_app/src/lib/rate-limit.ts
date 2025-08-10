import { LRUCache } from 'lru-cache';

export type RateLimitOptions = {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max number of tokens per interval
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

export function rateLimit(options: RateLimitOptions) {
  const tokenCache = new LRUCache<string, number[]>({
    max: options.uniqueTokenPerInterval || 500,
    ttl: options.interval || 60000,
  });

  return {
    check: (token: string): RateLimitResult => {
      const now = Date.now();
      const tokenCount = tokenCache.get(token) || [];
      const validTokens = tokenCount.filter(
        timestamp => now - timestamp < options.interval
      );

      if (validTokens.length >= options.uniqueTokenPerInterval) {
        return {
          success: false,
          limit: options.uniqueTokenPerInterval,
          remaining: 0,
          reset: Math.min(...validTokens) + options.interval,
        };
      }

      validTokens.push(now);
      tokenCache.set(token, validTokens);

      return {
        success: true,
        limit: options.uniqueTokenPerInterval,
        remaining: options.uniqueTokenPerInterval - validTokens.length,
        reset: now + options.interval,
      };
    },
  };
}

// Specific rate limiters for different endpoints
export const inviteCodeLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 5, // 5 attempts per hour
});

export const loginLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 10, // 10 attempts per 15 minutes
});

export const signupLimiter = rateLimit({
  interval: 60 * 60 * 1000, // 1 hour
  uniqueTokenPerInterval: 3, // 3 attempts per hour
});