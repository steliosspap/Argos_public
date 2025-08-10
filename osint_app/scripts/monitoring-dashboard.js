#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

class MonitoringDashboard {
  constructor() {
    this.port = process.env.MONITORING_PORT || 3001;
    this.server = null;
    this.metricsFile = path.join(process.cwd(), 'logs', 'metrics.json');
    this.alertsFile = path.join(process.cwd(), 'logs', 'alerts.json');
  }

  async getDashboardData() {
    try {
      // Get recent metrics from database
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { data: metrics, error } = await supabase
        .from('pipeline_metrics')
        .select('*')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Database error:', error);
      }

      // Get alerts
      const { data: alerts } = await supabase
        .from('pipeline_alerts')
        .select('*')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // Get local metrics if database is unavailable
      let localMetrics = [];
      let localAlerts = [];
      
      if (fs.existsSync(this.metricsFile)) {
        const data = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
        localMetrics = data.pipeline_health || [];
      }

      if (fs.existsSync(this.alertsFile)) {
        localAlerts = JSON.parse(fs.readFileSync(this.alertsFile, 'utf8'));
      }

      const allMetrics = [...(metrics || []), ...localMetrics]
        .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
        .slice(0, 100);

      const allAlerts = [...(alerts || []), ...localAlerts]
        .sort((a, b) => new Date(b.timestamp || b.created_at) - new Date(a.timestamp || a.created_at))
        .slice(0, 50);

      return {
        metrics: allMetrics,
        alerts: allAlerts,
        summary: this.calculateSummary(allMetrics, allAlerts),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      return {
        metrics: [],
        alerts: [],
        summary: { status: 'ERROR', message: error.message },
        timestamp: new Date().toISOString(),
      };
    }
  }

  calculateSummary(metrics, alerts) {
    if (metrics.length === 0) {
      return {
        status: 'NO_DATA',
        message: 'No metrics available',
        health_score: 0,
        uptime: '0%',
        alerts_24h: 0,
      };
    }

    const latestMetric = metrics[0];
    const currentScore = latestMetric.health_score || 0;
    const currentStatus = latestMetric.status || 'UNKNOWN';

    // Calculate uptime (percentage of healthy checks)
    const healthyChecks = metrics.filter(m => 
      (m.summary?.status || m.status) === 'HEALTHY'
    ).length;
    const uptime = metrics.length > 0 ? (healthyChecks / metrics.length) * 100 : 0;

    // Count recent alerts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = alerts.filter(a => 
      new Date(a.timestamp || a.created_at) > oneDayAgo
    ).length;

    // Calculate trends
    const recentScores = metrics.slice(0, 10).map(m => m.health_score || 0);
    const avgRecentScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const olderScores = metrics.slice(10, 20).map(m => m.health_score || 0);
    const avgOlderScore = olderScores.length > 0 ? 
      olderScores.reduce((a, b) => a + b, 0) / olderScores.length : avgRecentScore;
    
    const trend = avgRecentScore > avgOlderScore ? 'improving' : 
                 avgRecentScore < avgOlderScore ? 'declining' : 'stable';

    return {
      status: currentStatus,
      health_score: Math.round(currentScore),
      uptime: `${uptime.toFixed(1)}%`,
      alerts_24h: recentAlerts,
      trend: trend,
      last_check: latestMetric.timestamp || latestMetric.created_at,
      total_checks: metrics.length,
    };
  }

  generateHTML(data) {
    const { metrics, alerts, summary } = data;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Argos Pipeline Monitoring Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .status-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        
        .status-card:hover {
            transform: translateY(-5px);
        }
        
        .status-card h3 {
            font-size: 1.1rem;
            margin-bottom: 10px;
            color: #666;
        }
        
        .status-card .value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .status-healthy { color: #10b981; }
        .status-warning { color: #f59e0b; }
        .status-critical { color: #ef4444; }
        .status-unknown { color: #6b7280; }
        
        .chart-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .chart-container h3 {
            margin-bottom: 20px;
            color: #333;
        }
        
        .chart {
            height: 300px;
            position: relative;
            overflow: hidden;
        }
        
        .chart-line {
            position: absolute;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 1px;
        }
        
        .alerts-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .alert-item {
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 10px;
            border-left: 4px solid #ef4444;
        }
        
        .alert-critical {
            background: rgba(239, 68, 68, 0.1);
            border-left-color: #ef4444;
        }
        
        .alert-warning {
            background: rgba(245, 158, 11, 0.1);
            border-left-color: #f59e0b;
        }
        
        .alert-info {
            background: rgba(59, 130, 246, 0.1);
            border-left-color: #3b82f6;
        }
        
        .timestamp {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 5px;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease;
        }
        
        .refresh-btn:hover {
            transform: scale(1.1);
        }
        
        @media (max-width: 768px) {
            .status-grid {
                grid-template-columns: 1fr;
            }
            
            .header h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Argos Pipeline Monitor</h1>
            <p>Real-time intelligence pipeline health monitoring</p>
            <p><small>Last updated: ${new Date(data.timestamp).toLocaleString()}</small></p>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <h3>Pipeline Status</h3>
                <div class="value status-${summary.status?.toLowerCase() || 'unknown'}">${summary.status}</div>
                <div>Trend: ${summary.trend}</div>
            </div>
            
            <div class="status-card">
                <h3>Health Score</h3>
                <div class="value status-${summary.health_score > 80 ? 'healthy' : summary.health_score > 50 ? 'warning' : 'critical'}">${summary.health_score}</div>
                <div>Out of 100</div>
            </div>
            
            <div class="status-card">
                <h3>Uptime (24h)</h3>
                <div class="value status-${parseFloat(summary.uptime) > 95 ? 'healthy' : parseFloat(summary.uptime) > 80 ? 'warning' : 'critical'}">${summary.uptime}</div>
                <div>Healthy checks</div>
            </div>
            
            <div class="status-card">
                <h3>Alerts (24h)</h3>
                <div class="value status-${summary.alerts_24h === 0 ? 'healthy' : summary.alerts_24h < 5 ? 'warning' : 'critical'}">${summary.alerts_24h}</div>
                <div>Total alerts</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>📊 Health Score Trend</h3>
            <div class="chart">
                <div style="display: flex; justify-content: space-between; align-items: end; height: 100%;">
                    ${metrics.slice(0, 20).reverse().map((metric, i) => {
                        const score = metric.health_score || 0;
                        const height = Math.max(score, 5);
                        return `<div style="width: 4%; height: ${height}%; background: linear-gradient(0deg, ${score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444'}, ${score > 80 ? '#34d399' : score > 50 ? '#fbbf24' : '#f87171'}); border-radius: 2px; margin: 0 1px;" title="Score: ${score}"></div>`;
                    }).join('')}
                </div>
            </div>
        </div>
        
        <div class="alerts-container">
            <h3>🚨 Recent Alerts</h3>
            ${alerts.length === 0 ? '<p>No recent alerts</p>' : ''}
            ${alerts.slice(0, 10).map(alert => `
                <div class="alert-item alert-${alert.level?.toLowerCase() || 'info'}">
                    <div class="timestamp">${new Date(alert.timestamp || alert.created_at).toLocaleString()}</div>
                    <div><strong>${alert.level || 'INFO'}</strong>: ${alert.message}</div>
                </div>
            `).join('')}
        </div>
    </div>
    
    <button class="refresh-btn" onclick="location.reload()">
        ↻
    </button>
    
    <script>
        // Auto-refresh every 5 minutes
        setTimeout(() => {
            location.reload();
        }, 5 * 60 * 1000);
    </script>
</body>
</html>`;
  }

  async handleRequest(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      
      if (url.pathname === '/') {
        const data = await this.getDashboardData();
        const html = this.generateHTML(data);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else if (url.pathname === '/api/metrics') {
        const data = await this.getDashboardData();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
      } else if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'OK', 
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  start() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    
    this.server.listen(this.port, () => {
      console.log(`
🛡️ Argos Pipeline Monitoring Dashboard

Dashboard URL: http://localhost:${this.port}
API Endpoint: http://localhost:${this.port}/api/metrics
Health Check: http://localhost:${this.port}/health

Features:
- Real-time pipeline health monitoring
- Interactive dashboard with trends
- Alert history and notifications
- Auto-refresh every 5 minutes
- Mobile-responsive design

Press Ctrl+C to stop the server
      `);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    if (this.server) {
      console.log('\n🛑 Stopping monitoring dashboard...');
      this.server.close(() => {
        console.log('Dashboard stopped');
        process.exit(0);
      });
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new MonitoringDashboard();
  dashboard.start();
}

export default MonitoringDashboard;