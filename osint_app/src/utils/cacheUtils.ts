// Enhanced caching utilities for API responses and data management

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  key: string;
}

export interface CacheConfig {
  maxEntries: number;
  defaultTTL: number; // Time to live in milliseconds
  cleanupInterval: number;
  enableLogging: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalEntries: number;
  hitRate: number;
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxEntries: 100,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  enableLogging: process.env.NODE_ENV === 'development'
};

export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalEntries: 0,
    hitRate: 0
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  private log(message: string, ...args: any[]) {
    if (this.config.enableLogging) {
      console.log(`[Cache] ${message}`, ...args);
    }
  }

  private updateStats() {
    this.stats.totalEntries = this.cache.size;
    this.stats.hitRate = this.stats.hits + this.stats.misses > 0 
      ? this.stats.hits / (this.stats.hits + this.stats.misses) 
      : 0;
  }

  private startCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup() {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      this.log(`Cleaned up ${evicted} expired entries`);
      this.updateStats();
    }

    // Evict least recently used entries if over max capacity
    if (this.cache.size > this.config.maxEntries) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      const toEvict = this.cache.size - this.config.maxEntries;
      for (let i = 0; i < toEvict; i++) {
        const [key] = sortedEntries[i];
        this.cache.delete(key);
        this.stats.evictions++;
      }

      this.log(`Evicted ${toEvict} LRU entries`);
      this.updateStats();
    }
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const timeToLive = ttl || this.config.defaultTTL;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + timeToLive,
      accessCount: 0,
      lastAccessed: now,
      key
    };

    this.cache.set(key, entry);
    this.updateStats();
    this.log(`Set cache entry: ${key} (TTL: ${timeToLive}ms)`);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      this.log(`Cache miss: ${key}`);
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (entry.expiresAt < now) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      this.log(`Cache expired: ${key}`);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.stats.hits++;
    this.updateStats();
    this.log(`Cache hit: ${key} (accessed ${entry.accessCount} times)`);
    
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.updateStats();
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateStats();
      this.log(`Deleted cache entry: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.evictions += size;
    this.updateStats();
    this.log(`Cleared ${size} cache entries`);
  }

  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  getEntries(): Array<{ key: string; data: T; age: number; accessCount: number }> {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      data: entry.data,
      age: now - entry.timestamp,
      accessCount: entry.accessCount
    }));
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Global cache instances
export const apiCache = new MemoryCache({
  maxEntries: 50,
  defaultTTL: 5 * 60 * 1000, // 5 minutes for API responses
  enableLogging: true
});

export const dataCache = new MemoryCache({
  maxEntries: 200,
  defaultTTL: 10 * 60 * 1000, // 10 minutes for processed data
  enableLogging: true
});

// Cache key generators
export function createApiCacheKey(endpoint: string, params?: Record<string, any>): string {
  const paramString = params ? JSON.stringify(params) : '';
  return `api:${endpoint}:${btoa(paramString)}`;
}

export function createQueryCacheKey(table: string, filters?: Record<string, any>): string {
  const filterString = filters ? JSON.stringify(filters) : '';
  return `query:${table}:${btoa(filterString)}`;
}

// Cached fetch wrapper
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = apiCache.get(key);
  if (cached !== null) {
    return cached as T;
  }

  // Not in cache, fetch data
  try {
    const data = await fetcher();
    apiCache.set(key, data, ttl);
    return data;
  } catch (error) {
    // Don't cache errors
    throw error;
  }
}

// React Query cache integration utilities
export function getCacheTime(type: 'fast' | 'medium' | 'slow' = 'medium'): number {
  switch (type) {
    case 'fast':
      return 2 * 60 * 1000; // 2 minutes
    case 'medium':
      return 5 * 60 * 1000; // 5 minutes
    case 'slow':
      return 15 * 60 * 1000; // 15 minutes
    default:
      return 5 * 60 * 1000;
  }
}

export function getStaleTime(type: 'fast' | 'medium' | 'slow' = 'medium'): number {
  switch (type) {
    case 'fast':
      return 30 * 1000; // 30 seconds
    case 'medium':
      return 2 * 60 * 1000; // 2 minutes
    case 'slow':
      return 5 * 60 * 1000; // 5 minutes
    default:
      return 2 * 60 * 1000;
  }
}

// Local storage cache for persistence across sessions
export class PersistentCache<T = any> {
  private prefix: string;
  private defaultTTL: number;

  constructor(prefix: string = 'argos_cache_', defaultTTL: number = 24 * 60 * 60 * 1000) {
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }

  private getStorageKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  set(key: string, data: T, ttl?: number): boolean {
    try {
      if (typeof window === 'undefined') return false;
      
      const entry = {
        data,
        expiresAt: Date.now() + (ttl || this.defaultTTL),
        timestamp: Date.now()
      };

      localStorage.setItem(this.getStorageKey(key), JSON.stringify(entry));
      return true;
    } catch (error) {
      console.warn('[PersistentCache] Failed to set cache entry:', error);
      return false;
    }
  }

  get(key: string): T | null {
    try {
      if (typeof window === 'undefined') return null;
      
      const item = localStorage.getItem(this.getStorageKey(key));
      if (!item) return null;

      const entry = JSON.parse(item);
      
      // Check if expired
      if (entry.expiresAt < Date.now()) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('[PersistentCache] Failed to get cache entry:', error);
      return null;
    }
  }

  delete(key: string): boolean {
    try {
      if (typeof window === 'undefined') return false;
      
      localStorage.removeItem(this.getStorageKey(key));
      return true;
    } catch (error) {
      console.warn('[PersistentCache] Failed to delete cache entry:', error);
      return false;
    }
  }

  clear(): void {
    try {
      if (typeof window === 'undefined') return;
      
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('[PersistentCache] Failed to clear cache:', error);
    }
  }

  cleanup(): number {
    try {
      if (typeof window === 'undefined') return 0;
      
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
      let cleaned = 0;

      keys.forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry = JSON.parse(item);
            if (entry.expiresAt < Date.now()) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch {
          // Invalid entry, remove it
          localStorage.removeItem(key);
          cleaned++;
        }
      });

      return cleaned;
    } catch (error) {
      console.warn('[PersistentCache] Failed to cleanup cache:', error);
      return 0;
    }
  }
}

// Global persistent cache instance
export const persistentCache = new PersistentCache('argos_', 24 * 60 * 60 * 1000);

// Cache debugging utilities
export function logCacheStats(): void {
  console.group('📊 Cache Statistics');
  console.log('API Cache:', apiCache.getStats());
  console.log('Data Cache:', dataCache.getStats());
  console.groupEnd();
}

// Initialize cache cleanup on module load
if (typeof window !== 'undefined') {
  // Clean up persistent cache on page load
  persistentCache.cleanup();
  
  // Set up periodic cleanup
  setInterval(() => {
    persistentCache.cleanup();
  }, 10 * 60 * 1000); // Every 10 minutes
}