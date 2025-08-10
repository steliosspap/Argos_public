#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const log = console.log;
const error = console.error;

// Pipeline health thresholds
const HEALTH_THRESHOLDS = {
  MIN_HOURLY_ARTICLES: 5,
  MIN_HOURLY_EVENTS: 2,
  MIN_CONVERSION_RATE: 10,
  MAX_DUPLICATE_RATE: 5,
  MAX_ERROR_RATE: 10
};

/**
 * Calculate pipeline metrics
 * @param {number} hours - Hours to look back
 * @returns {Object} - Pipeline metrics
 */
async function calculateMetrics(hours = 1) {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hours);
  
  // Get news count
  const { count: newsCount } = await supabase
    .from('news')
    .select('*', { count: 'exact', head: true })
    .gte('published_at', cutoffTime.toISOString());
    
  // Get events count
  const { count: eventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', cutoffTime.toISOString())
    .eq('channel', 'news');
    
  // Get duplicate count (events with same content_hash)
  const { data: duplicateData } = await supabase
    .from('events')
    .select('content_hash')
    .gte('timestamp', cutoffTime.toISOString())
    .not('content_hash', 'is', null);
    
  const hashCounts = {};
  duplicateData?.forEach(row => {
    hashCounts[row.content_hash] = (hashCounts[row.content_hash] || 0) + 1;
  });
  
  const duplicates = Object.values(hashCounts).filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0);
  
  // Get events without coordinates
  const { count: noCoordCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', cutoffTime.toISOString())
    .or('latitude.is.null,longitude.is.null');
    
  // Calculate metrics
  const conversionRate = newsCount > 0 ? (eventsCount / newsCount * 100) : 0;
  const duplicateRate = eventsCount > 0 ? (duplicates / eventsCount * 100) : 0;
  const geoAccuracy = eventsCount > 0 ? ((eventsCount - noCoordCount) / eventsCount * 100) : 0;
  
  return {
    period: `${hours}h`,
    timestamp: new Date().toISOString(),
    news_articles: newsCount || 0,
    events_ingested: eventsCount || 0,
    duplicates_found: duplicates,
    duplicate_rate: duplicateRate.toFixed(2),
    conversion_rate: conversionRate.toFixed(2),
    geo_accuracy: geoAccuracy.toFixed(2),
    events_without_coords: noCoordCount || 0
  };
}

/**
 * Check pipeline health
 * @param {Object} metrics - Pipeline metrics
 * @returns {Object} - Health status
 */
function checkHealth(metrics) {
  const issues = [];
  
  if (metrics.news_articles < HEALTH_THRESHOLDS.MIN_HOURLY_ARTICLES) {
    issues.push({
      severity: 'critical',
      message: `Low news ingestion: ${metrics.news_articles} articles (threshold: ${HEALTH_THRESHOLDS.MIN_HOURLY_ARTICLES})`
    });
  }
  
  if (metrics.events_ingested < HEALTH_THRESHOLDS.MIN_HOURLY_EVENTS) {
    issues.push({
      severity: 'critical',
      message: `Low event extraction: ${metrics.events_ingested} events (threshold: ${HEALTH_THRESHOLDS.MIN_HOURLY_EVENTS})`
    });
  }
  
  if (parseFloat(metrics.conversion_rate) < HEALTH_THRESHOLDS.MIN_CONVERSION_RATE && metrics.news_articles > 0) {
    issues.push({
      severity: 'warning',
      message: `Low conversion rate: ${metrics.conversion_rate}% (threshold: ${HEALTH_THRESHOLDS.MIN_CONVERSION_RATE}%)`
    });
  }
  
  if (parseFloat(metrics.duplicate_rate) > HEALTH_THRESHOLDS.MAX_DUPLICATE_RATE) {
    issues.push({
      severity: 'warning',
      message: `High duplicate rate: ${metrics.duplicate_rate}% (threshold: ${HEALTH_THRESHOLDS.MAX_DUPLICATE_RATE}%)`
    });
  }
  
  if (parseFloat(metrics.geo_accuracy) < 70) {
    issues.push({
      severity: 'info',
      message: `Low geocoding accuracy: ${metrics.geo_accuracy}%`
    });
  }
  
  return {
    healthy: issues.filter(i => i.severity === 'critical').length === 0,
    status: issues.length === 0 ? 'healthy' : issues.some(i => i.severity === 'critical') ? 'critical' : 'warning',
    issues
  };
}

/**
 * Send alert (placeholder - implement your alerting method)
 * @param {string} level - Alert level
 * @param {string} message - Alert message
 * @param {Object} data - Additional data
 */
async function sendAlert(level, message, data) {
  // TODO: Implement your alerting method (email, Slack, etc.)
  console.error(`[ALERT] ${level.toUpperCase()}: ${message}`);
  console.error('Details:', JSON.stringify(data, null, 2));
  
  // You could implement:
  // - Email alerts via SendGrid/AWS SES
  // - Slack webhooks
  // - PagerDuty integration
  // - Database logging
}

/**
 * Monitor pipeline continuously
 * @param {number} intervalMinutes - Check interval
 */
async function monitorContinuously(intervalMinutes = 5) {
  log(`🔍 Starting continuous pipeline monitoring (checking every ${intervalMinutes} minutes)...\n`);
  
  const check = async () => {
    try {
      const metrics = await calculateMetrics(1);
      const health = checkHealth(metrics);
      
      const timestamp = new Date().toLocaleTimeString();
      
      if (health.healthy) {
        log(`[${timestamp}] ✅ Pipeline healthy | Articles: ${metrics.news_articles} | Events: ${metrics.events_ingested} | Duplicates: ${metrics.duplicate_rate}%`);
      } else {
        log(`[${timestamp}] ⚠️  Pipeline ${health.status.toUpperCase()}`);
        health.issues.forEach(issue => {
          log(`  - [${issue.severity}] ${issue.message}`);
        });
        
        // Send alerts for critical issues
        const criticalIssues = health.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
          await sendAlert('critical', 'Pipeline health check failed', { metrics, issues: criticalIssues });
        }
      }
      
      // Log to monitoring table (optional)
      await logMetrics(metrics, health);
      
    } catch (err) {
      error(`Monitor error: ${err.message}`);
    }
  };
  
  // Initial check
  await check();
  
  // Set up interval
  setInterval(check, intervalMinutes * 60 * 1000);
}

/**
 * Log metrics to database
 * @param {Object} metrics - Pipeline metrics
 * @param {Object} health - Health status
 */
async function logMetrics(metrics, health) {
  try {
    // Create monitoring table if needed
    const monitoringData = {
      timestamp: new Date().toISOString(),
      metrics: metrics,
      health_status: health.status,
      issues: health.issues,
      healthy: health.healthy
    };
    
    // You could create a 'pipeline_monitoring' table to track this
    // await supabase.from('pipeline_monitoring').insert(monitoringData);
    
  } catch (err) {
    error(`Failed to log metrics: ${err.message}`);
  }
}

/**
 * Generate health report
 */
async function generateHealthReport() {
  log('📊 PIPELINE HEALTH REPORT');
  log('=' .repeat(60));
  log(`Generated at: ${new Date().toISOString()}`);
  log('=' .repeat(60));
  
  // Get metrics for different periods
  const periods = [1, 6, 24, 48];
  const allMetrics = [];
  
  for (const hours of periods) {
    const metrics = await calculateMetrics(hours);
    const health = checkHealth(metrics);
    allMetrics.push({ metrics, health });
    
    log(`\n📈 Last ${hours} hour(s):`);
    log(`  Status: ${health.status.toUpperCase()} ${health.healthy ? '✅' : '⚠️'}`);
    log(`  News Articles: ${metrics.news_articles}`);
    log(`  Events Ingested: ${metrics.events_ingested}`);
    log(`  Conversion Rate: ${metrics.conversion_rate}%`);
    log(`  Duplicate Rate: ${metrics.duplicate_rate}%`);
    log(`  Geocoding Accuracy: ${metrics.geo_accuracy}%`);
    
    if (health.issues.length > 0) {
      log('  Issues:');
      health.issues.forEach(issue => {
        log(`    - [${issue.severity}] ${issue.message}`);
      });
    }
  }
  
  // Trend analysis
  log('\n📊 Trend Analysis:');
  
  const hourlyRate = allMetrics[0].metrics.events_ingested;
  const dailyProjection = hourlyRate * 24;
  log(`  Current ingestion rate: ${hourlyRate} events/hour`);
  log(`  Projected daily total: ${dailyProjection} events`);
  
  // Recommendations
  log('\n💡 Recommendations:');
  
  const latestHealth = allMetrics[0].health;
  if (!latestHealth.healthy) {
    if (parseFloat(allMetrics[0].metrics.news_articles) === 0) {
      log('  1. Check news fetcher services - no articles being ingested');
      log('  2. Verify RSS feeds and scraper configurations');
    }
    if (parseFloat(allMetrics[0].metrics.conversion_rate) < 10) {
      log('  1. Review OpenAI prompt effectiveness');
      log('  2. Check for API errors or rate limiting');
    }
    if (parseFloat(allMetrics[0].metrics.duplicate_rate) > 5) {
      log('  1. Review deduplication logic');
      log('  2. Check content_hash generation');
    }
  } else {
    log('  ✅ Pipeline is operating normally');
  }
  
  log('\n' + '=' .repeat(60));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'report';
  
  switch (command) {
    case 'report':
      await generateHealthReport();
      break;
      
    case 'monitor':
      const interval = parseInt(args[1]) || 5;
      await monitorContinuously(interval);
      break;
      
    case 'check':
      const metrics = await calculateMetrics(1);
      const health = checkHealth(metrics);
      console.log(JSON.stringify({ metrics, health }, null, 2));
      process.exit(health.healthy ? 0 : 1);
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run monitor-health              # Generate health report');
      console.log('  npm run monitor-health monitor [interval]  # Continuous monitoring');
      console.log('  npm run monitor-health check        # Single health check (for CI/CD)');
  }
}

main().catch(err => {
  error(`Fatal error: ${err.message}`);
  process.exit(1);
});