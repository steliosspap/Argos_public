#!/usr/bin/env node

/**
 * Health check script for Argos Enhanced Pipeline
 * Used by Docker to determine container health
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Health check configuration
const CHECKS = {
  lastRunMaxAge: 3600000, // 1 hour in ms
  minEventsPerRun: 1,
  maxErrorRate: 0.1, // 10%
  requiredFiles: ['cli-enhanced.js', 'config.js'],
  requiredDirs: ['logs', 'modules', 'lib']
};

// Initialize Supabase client if credentials available
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function checkFileSystem() {
  const issues = [];
  
  // Check required files
  for (const file of CHECKS.requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, file))) {
      issues.push(`Missing required file: ${file}`);
    }
  }
  
  // Check required directories
  for (const dir of CHECKS.requiredDirs) {
    if (!fs.existsSync(path.join(__dirname, dir))) {
      issues.push(`Missing required directory: ${dir}`);
    }
  }
  
  // Check log directory is writable
  try {
    const testFile = path.join(__dirname, 'logs', '.health-check-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    issues.push('Log directory is not writable');
  }
  
  return issues;
}

async function checkLastRun() {
  const issues = [];
  
  try {
    // Check pipeline stats file
    const statsFile = path.join(__dirname, 'logs', 'pipeline-stats.json');
    if (fs.existsSync(statsFile)) {
      const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
      const lastRun = new Date(stats.timestamp);
      const age = Date.now() - lastRun.getTime();
      
      if (age > CHECKS.lastRunMaxAge) {
        issues.push(`Pipeline hasn't run in ${Math.round(age / 3600000)} hours`);
      }
      
      if (stats.processed && stats.processed.events < CHECKS.minEventsPerRun) {
        issues.push(`Last run processed only ${stats.processed.events} events`);
      }
      
      if (stats.errors && stats.processed) {
        const errorRate = stats.errors.total / (stats.processed.total || 1);
        if (errorRate > CHECKS.maxErrorRate) {
          issues.push(`High error rate: ${Math.round(errorRate * 100)}%`);
        }
      }
    } else {
      issues.push('No pipeline stats file found');
    }
  } catch (error) {
    issues.push(`Failed to check last run: ${error.message}`);
  }
  
  return issues;
}

async function checkDatabaseConnection() {
  const issues = [];
  
  if (!supabase) {
    issues.push('Database credentials not configured');
    return issues;
  }
  
  try {
    // Try a simple query
    const { error } = await supabase
      .from('events')
      .select('id')
      .limit(1);
    
    if (error) {
      issues.push(`Database query failed: ${error.message}`);
    }
  } catch (error) {
    issues.push(`Database connection failed: ${error.message}`);
  }
  
  return issues;
}

async function checkRedisConnection() {
  const issues = [];
  
  if (!process.env.REDIS_URL) {
    // Redis is optional, so no issue if not configured
    return issues;
  }
  
  try {
    const redis = require('redis');
    const client = redis.createClient({ url: process.env.REDIS_URL });
    
    await client.connect();
    await client.ping();
    await client.quit();
  } catch (error) {
    issues.push(`Redis connection failed: ${error.message}`);
  }
  
  return issues;
}

async function checkMemoryUsage() {
  const issues = [];
  
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const maxMemoryMB = parseInt(process.env.MAX_MEMORY_MB || '3072');
  
  if (heapUsedMB > maxMemoryMB * 0.9) {
    issues.push(`High memory usage: ${heapUsedMB}MB / ${maxMemoryMB}MB`);
  }
  
  return issues;
}

async function runHealthCheck() {
  console.log('🏥 Running health check...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    healthy: true,
    checks: {},
    issues: []
  };
  
  // Run all checks
  const checks = [
    { name: 'fileSystem', fn: checkFileSystem },
    { name: 'lastRun', fn: checkLastRun },
    { name: 'database', fn: checkDatabaseConnection },
    { name: 'redis', fn: checkRedisConnection },
    { name: 'memory', fn: checkMemoryUsage }
  ];
  
  for (const check of checks) {
    try {
      const issues = await check.fn();
      results.checks[check.name] = {
        passed: issues.length === 0,
        issues
      };
      
      if (issues.length > 0) {
        results.healthy = false;
        results.issues.push(...issues);
      }
    } catch (error) {
      results.checks[check.name] = {
        passed: false,
        issues: [`Check failed: ${error.message}`]
      };
      results.healthy = false;
      results.issues.push(`${check.name} check failed: ${error.message}`);
    }
  }
  
  // Write results to file
  const healthFile = path.join(__dirname, 'logs', 'health.json');
  fs.writeFileSync(healthFile, JSON.stringify(results, null, 2));
  
  // Print summary
  if (results.healthy) {
    console.log('✅ All health checks passed\n');
  } else {
    console.log('❌ Health check failed\n');
    console.log('Issues found:');
    results.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  // Exit with appropriate code
  process.exit(results.healthy ? 0 : 1);
}

// Run health check
runHealthCheck().catch(error => {
  console.error('Health check error:', error);
  process.exit(1);
});