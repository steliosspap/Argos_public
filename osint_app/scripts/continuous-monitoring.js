#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MONITORING_CONFIG = {
  intervals: {
    health_check: 5 * 60 * 1000,      // 5 minutes
    metrics_collection: 15 * 60 * 1000, // 15 minutes
    alert_check: 10 * 60 * 1000,      // 10 minutes
    cleanup: 60 * 60 * 1000,          // 1 hour
  },
  thresholds: {
    min_hourly_articles: 3,
    min_hourly_events: 1,
    min_conversion_rate: 15,
    max_duplicate_rate: 10,
    max_error_rate: 15,
    max_latency_ms: 30000,
  },
  retention: {
    health_logs: 7 * 24 * 60 * 60 * 1000,  // 7 days
    metrics: 30 * 24 * 60 * 60 * 1000,     // 30 days
    alerts: 90 * 24 * 60 * 60 * 1000,      // 90 days
  }
};

class ContinuousMonitor {
  constructor() {
    this.running = false;
    this.intervals = {};
    this.logFile = path.join(process.cwd(), 'logs', 'monitoring.log');
    this.metricsFile = path.join(process.cwd(), 'logs', 'metrics.json');
    this.alertsFile = path.join(process.cwd(), 'logs', 'alerts.json');
    
    this.ensureLogDirectory();
    this.initializeMetrics();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  initializeMetrics() {
    if (!fs.existsSync(this.metricsFile)) {
      fs.writeFileSync(this.metricsFile, JSON.stringify({
        pipeline_health: [],
        system_metrics: [],
        error_rates: [],
        performance_metrics: []
      }, null, 2));
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid
    };

    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }

    // Append to log file
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
  }

  async collectPipelineHealth() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Fetch recent events
      const { data: recentEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .gte('timestamp', oneDayAgo.toISOString())
        .order('timestamp', { ascending: false });

      if (eventsError) {
        throw new Error(`Failed to fetch events: ${eventsError.message}`);
      }

      // Fetch recent ingestion logs (if available)
      const { data: ingestionLogs, error: logsError } = await supabase
        .from('ingestion_logs')
        .select('*')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false });

      // Calculate metrics
      const metrics = this.calculateHealthMetrics(recentEvents, ingestionLogs);
      
      // Store metrics
      await this.storeMetrics(metrics);
      
      // Check for alerts
      await this.checkAlerts(metrics);

      this.log('info', 'Pipeline health check completed', {
        events_count: recentEvents.length,
        metrics: metrics.summary
      });

      return metrics;

    } catch (error) {
      this.log('error', 'Pipeline health check failed', { error: error.message });
      throw error;
    }
  }

  calculateHealthMetrics(events, logs) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = events.filter(e => new Date(e.timestamp) >= oneHourAgo);
    const dailyEvents = events.filter(e => new Date(e.timestamp) >= oneDayAgo);

    // Calculate duplicates
    const duplicates = this.findDuplicateEvents(dailyEvents);
    const duplicateRate = dailyEvents.length > 0 ? (duplicates.length / dailyEvents.length) * 100 : 0;

    // Calculate severity distribution
    const severityDistribution = dailyEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {});

    // Calculate geographic distribution
    const geoDistribution = dailyEvents.reduce((acc, event) => {
      if (event.latitude && event.longitude) {
        acc.with_coordinates++;
      } else {
        acc.without_coordinates++;
      }
      return acc;
    }, { with_coordinates: 0, without_coordinates: 0 });

    const geoAccuracy = dailyEvents.length > 0 ? 
      (geoDistribution.with_coordinates / dailyEvents.length) * 100 : 0;

    // Calculate error rates from logs
    const errorRate = logs ? this.calculateErrorRate(logs) : 0;

    // Calculate conversion rate (events per processed article)
    const conversionRate = logs ? this.calculateConversionRate(logs, dailyEvents) : 0;

    const metrics = {
      timestamp: now.toISOString(),
      events: {
        total_24h: dailyEvents.length,
        total_1h: recentEvents.length,
        hourly_rate: recentEvents.length,
        daily_rate: dailyEvents.length,
      },
      quality: {
        duplicate_rate: duplicateRate,
        geo_accuracy: geoAccuracy,
        error_rate: errorRate,
        conversion_rate: conversionRate,
      },
      distribution: {
        severity: severityDistribution,
        geography: geoDistribution,
      },
      health_score: this.calculateHealthScore({
        hourly_events: recentEvents.length,
        duplicate_rate: duplicateRate,
        geo_accuracy: geoAccuracy,
        error_rate: errorRate,
        conversion_rate: conversionRate,
      }),
      summary: {
        status: this.getHealthStatus(recentEvents.length, duplicateRate, errorRate, conversionRate),
        critical_issues: this.getCriticalIssues(recentEvents.length, duplicateRate, errorRate, conversionRate),
      }
    };

    return metrics;
  }

  findDuplicateEvents(events) {
    const seen = new Set();
    const duplicates = [];

    for (const event of events) {
      const hash = this.generateEventHash(event);
      if (seen.has(hash)) {
        duplicates.push(event);
      } else {
        seen.add(hash);
      }
    }

    return duplicates;
  }

  generateEventHash(event) {
    const content = [
      event.title?.trim().toLowerCase(),
      event.country?.trim().toLowerCase(),
      (event.city || event.region)?.trim().toLowerCase(),
      new Date(event.timestamp).toISOString().split('T')[0]
    ].filter(Boolean).join('|');
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  calculateErrorRate(logs) {
    if (!logs || logs.length === 0) return 0;
    
    const errorLogs = logs.filter(log => log.level === 'error' || log.status === 'error');
    return (errorLogs.length / logs.length) * 100;
  }

  calculateConversionRate(logs, events) {
    if (!logs || logs.length === 0) return 0;
    
    const articlesProcessed = logs.filter(log => log.type === 'article_processed').length;
    return articlesProcessed > 0 ? (events.length / articlesProcessed) * 100 : 0;
  }

  calculateHealthScore(metrics) {
    let score = 100;

    // Deduct points for low hourly events
    if (metrics.hourly_events < MONITORING_CONFIG.thresholds.min_hourly_events) {
      score -= 30;
    }

    // Deduct points for high duplicate rate
    if (metrics.duplicate_rate > MONITORING_CONFIG.thresholds.max_duplicate_rate) {
      score -= 20;
    }

    // Deduct points for high error rate
    if (metrics.error_rate > MONITORING_CONFIG.thresholds.max_error_rate) {
      score -= 25;
    }

    // Deduct points for low conversion rate
    if (metrics.conversion_rate < MONITORING_CONFIG.thresholds.min_conversion_rate) {
      score -= 15;
    }

    // Deduct points for low geo accuracy
    if (metrics.geo_accuracy < 70) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  getHealthStatus(hourlyEvents, duplicateRate, errorRate, conversionRate) {
    const criticalIssues = this.getCriticalIssues(hourlyEvents, duplicateRate, errorRate, conversionRate);
    
    if (criticalIssues.length > 0) {
      return 'CRITICAL';
    }

    if (hourlyEvents < MONITORING_CONFIG.thresholds.min_hourly_events * 2 ||
        duplicateRate > MONITORING_CONFIG.thresholds.max_duplicate_rate / 2 ||
        errorRate > MONITORING_CONFIG.thresholds.max_error_rate / 2) {
      return 'WARNING';
    }

    return 'HEALTHY';
  }

  getCriticalIssues(hourlyEvents, duplicateRate, errorRate, conversionRate) {
    const issues = [];

    if (hourlyEvents < MONITORING_CONFIG.thresholds.min_hourly_events) {
      issues.push(`Low event generation: ${hourlyEvents}/hour (min: ${MONITORING_CONFIG.thresholds.min_hourly_events})`);
    }

    if (duplicateRate > MONITORING_CONFIG.thresholds.max_duplicate_rate) {
      issues.push(`High duplicate rate: ${duplicateRate.toFixed(1)}% (max: ${MONITORING_CONFIG.thresholds.max_duplicate_rate}%)`);
    }

    if (errorRate > MONITORING_CONFIG.thresholds.max_error_rate) {
      issues.push(`High error rate: ${errorRate.toFixed(1)}% (max: ${MONITORING_CONFIG.thresholds.max_error_rate}%)`);
    }

    if (conversionRate < MONITORING_CONFIG.thresholds.min_conversion_rate) {
      issues.push(`Low conversion rate: ${conversionRate.toFixed(1)}% (min: ${MONITORING_CONFIG.thresholds.min_conversion_rate}%)`);
    }

    return issues;
  }

  async storeMetrics(metrics) {
    try {
      const metricsData = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      
      metricsData.pipeline_health.push(metrics);
      
      // Keep only recent metrics
      const cutoff = new Date(Date.now() - MONITORING_CONFIG.retention.metrics);
      metricsData.pipeline_health = metricsData.pipeline_health.filter(
        m => new Date(m.timestamp) > cutoff
      );

      fs.writeFileSync(this.metricsFile, JSON.stringify(metricsData, null, 2));
      
      // Also store in database if available
      await supabase
        .from('pipeline_metrics')
        .insert([{
          timestamp: metrics.timestamp,
          health_score: metrics.health_score,
          status: metrics.summary.status,
          metrics: metrics,
          created_at: new Date().toISOString(),
        }])
        .single();

    } catch (error) {
      this.log('error', 'Failed to store metrics', { error: error.message });
    }
  }

  async checkAlerts(metrics) {
    if (metrics.summary.status === 'CRITICAL') {
      await this.sendAlert('CRITICAL', 'Pipeline health is critical', {
        health_score: metrics.health_score,
        issues: metrics.summary.critical_issues,
        metrics: metrics.summary,
      });
    }
  }

  async sendAlert(level, message, data) {
    const alert = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      id: crypto.randomUUID(),
    };

    this.log('alert', message, data);

    try {
      const alertsData = fs.existsSync(this.alertsFile) ? 
        JSON.parse(fs.readFileSync(this.alertsFile, 'utf8')) : [];
      
      alertsData.push(alert);
      
      // Keep only recent alerts
      const cutoff = new Date(Date.now() - MONITORING_CONFIG.retention.alerts);
      const recentAlerts = alertsData.filter(a => new Date(a.timestamp) > cutoff);
      
      fs.writeFileSync(this.alertsFile, JSON.stringify(recentAlerts, null, 2));

      // Store in database
      await supabase
        .from('pipeline_alerts')
        .insert([{
          level,
          message,
          data,
          created_at: alert.timestamp,
        }]);

    } catch (error) {
      this.log('error', 'Failed to store alert', { error: error.message });
    }
  }

  async collectSystemMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        version: process.version,
      };

      // Store system metrics
      const metricsData = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      metricsData.system_metrics.push(metrics);
      
      // Keep only recent metrics
      const cutoff = new Date(Date.now() - MONITORING_CONFIG.retention.metrics);
      metricsData.system_metrics = metricsData.system_metrics.filter(
        m => new Date(m.timestamp) > cutoff
      );

      fs.writeFileSync(this.metricsFile, JSON.stringify(metricsData, null, 2));

      this.log('info', 'System metrics collected', {
        memory_mb: Math.round(metrics.memory.rss / 1024 / 1024),
        uptime_hours: Math.round(metrics.uptime / 3600),
      });

    } catch (error) {
      this.log('error', 'Failed to collect system metrics', { error: error.message });
    }
  }

  async cleanup() {
    try {
      // Clean up old log files
      const logFiles = fs.readdirSync(path.dirname(this.logFile));
      const cutoff = new Date(Date.now() - MONITORING_CONFIG.retention.health_logs);
      
      for (const file of logFiles) {
        const filePath = path.join(path.dirname(this.logFile), file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoff) {
          fs.unlinkSync(filePath);
          this.log('info', `Cleaned up old log file: ${file}`);
        }
      }

      // Clean up old database records
      await supabase
        .from('pipeline_metrics')
        .delete()
        .lt('created_at', new Date(Date.now() - MONITORING_CONFIG.retention.metrics).toISOString());

      await supabase
        .from('pipeline_alerts')
        .delete()
        .lt('created_at', new Date(Date.now() - MONITORING_CONFIG.retention.alerts).toISOString());

      this.log('info', 'Cleanup completed');

    } catch (error) {
      this.log('error', 'Cleanup failed', { error: error.message });
    }
  }

  start() {
    if (this.running) {
      this.log('warn', 'Monitor is already running');
      return;
    }

    this.running = true;
    this.log('info', 'Starting continuous monitoring', {
      config: MONITORING_CONFIG,
      pid: process.pid,
    });

    // Set up intervals
    this.intervals.health_check = setInterval(
      () => this.collectPipelineHealth().catch(err => this.log('error', 'Health check failed', { error: err.message })),
      MONITORING_CONFIG.intervals.health_check
    );

    this.intervals.metrics_collection = setInterval(
      () => this.collectSystemMetrics().catch(err => this.log('error', 'Metrics collection failed', { error: err.message })),
      MONITORING_CONFIG.intervals.metrics_collection
    );

    this.intervals.cleanup = setInterval(
      () => this.cleanup().catch(err => this.log('error', 'Cleanup failed', { error: err.message })),
      MONITORING_CONFIG.intervals.cleanup
    );

    // Initial health check
    this.collectPipelineHealth().catch(err => 
      this.log('error', 'Initial health check failed', { error: err.message })
    );

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.log('info', 'Stopping continuous monitoring');
    this.running = false;

    // Clear intervals
    Object.values(this.intervals).forEach(interval => clearInterval(interval));
    this.intervals = {};

    process.exit(0);
  }

  async getStatus() {
    try {
      const metrics = await this.collectPipelineHealth();
      return {
        status: 'running',
        uptime: process.uptime(),
        last_check: metrics.timestamp,
        health_score: metrics.health_score,
        pipeline_status: metrics.summary.status,
        critical_issues: metrics.summary.critical_issues,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        uptime: process.uptime(),
      };
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new ContinuousMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      monitor.start();
      break;
    
    case 'status':
      monitor.getStatus().then(status => {
        console.log('Monitor Status:', JSON.stringify(status, null, 2));
        process.exit(0);
      }).catch(err => {
        console.error('Failed to get status:', err.message);
        process.exit(1);
      });
      break;
    
    case 'check':
      monitor.collectPipelineHealth().then(metrics => {
        console.log('Pipeline Health:', JSON.stringify(metrics, null, 2));
        process.exit(0);
      }).catch(err => {
        console.error('Health check failed:', err.message);
        process.exit(1);
      });
      break;
    
    default:
      console.log(`
Usage: node continuous-monitoring.js <command>

Commands:
  start   - Start continuous monitoring
  status  - Get current monitor status
  check   - Run one-time health check

The monitor will run continuously and check pipeline health every 5 minutes.
Logs are stored in logs/monitoring.log
Metrics are stored in logs/metrics.json
Alerts are stored in logs/alerts.json
      `);
      process.exit(1);
  }
}

export default ContinuousMonitor;