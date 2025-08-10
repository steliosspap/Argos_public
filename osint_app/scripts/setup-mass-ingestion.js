#!/usr/bin/env node

/**
 * Setup script for mass news ingestion system
 * Prepares the environment for processing thousands of articles daily
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class MassIngestionSetup {
  constructor() {
    this.baseDir = path.join(__dirname, '..');
    this.requiredDirs = [
      'data/rss-ingestion',
      'data/translated-articles',
      'data/batch-output',
      'data/translation-cache',
      'data/temp',
      'data/logs',
      'data/monitoring'
    ];
    
    this.requiredEnvVars = [
      'OPENAI_API_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_KEY'
    ];
    
    this.optionalEnvVars = [
      'GOOGLE_TRANSLATE_API_KEY',
      'MAPBOX_ACCESS_TOKEN'
    ];
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async createDirectories() {
    await this.log('Creating required directories...');
    
    for (const dir of this.requiredDirs) {
      const fullPath = path.join(this.baseDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        await this.log(`✅ Created directory: ${dir}`);
      } else {
        await this.log(`📁 Directory exists: ${dir}`);
      }
    }
  }

  async checkEnvironment() {
    await this.log('Checking environment variables...');
    
    const missing = [];
    const optional = [];
    
    for (const envVar of this.requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar);
      } else {
        await this.log(`✅ Found required variable: ${envVar}`);
      }
    }
    
    for (const envVar of this.optionalEnvVars) {
      if (!process.env[envVar]) {
        optional.push(envVar);
      } else {
        await this.log(`✅ Found optional variable: ${envVar}`);
      }
    }
    
    if (missing.length > 0) {
      await this.log('❌ Missing required environment variables:');
      missing.forEach(v => console.log(`   - ${v}`));
      throw new Error('Missing required environment variables');
    }
    
    if (optional.length > 0) {
      await this.log('⚠️  Optional environment variables not set:');
      optional.forEach(v => console.log(`   - ${v}`));
    }
  }

  async checkDependencies() {
    await this.log('Checking Node.js dependencies...');
    
    const packageJsonPath = path.join(this.baseDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found');
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredDeps = [
      'axios',
      'rss-parser',
      '@supabase/supabase-js',
      'openai',
      'dotenv'
    ];
    
    const missing = requiredDeps.filter(dep => 
      !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
    );
    
    if (missing.length > 0) {
      await this.log('❌ Missing required dependencies:');
      missing.forEach(dep => console.log(`   - ${dep}`));
      
      await this.log('Installing missing dependencies...');
      try {
        await execAsync(`cd ${this.baseDir} && npm install ${missing.join(' ')}`, {
          stdio: 'inherit'
        });
        await this.log('✅ Dependencies installed successfully');
      } catch (error) {
        throw new Error(`Failed to install dependencies: ${error.message}`);
      }
    } else {
      await this.log('✅ All required dependencies are installed');
    }
  }

  async createConfigFiles() {
    await this.log('Creating configuration files...');
    
    // Create ingestion configuration
    const ingestionConfig = {
      global: {
        maxConcurrentSources: 10,
        requestTimeout: 30000,
        retryAttempts: 3,
        rateLimitDelay: 100
      },
      translation: {
        defaultService: 'openai',
        batchSize: 3,
        cacheEnabled: true,
        cacheMaxAge: 2592000000 // 30 days
      },
      processing: {
        maxArticlesPerBatch: 1000,
        duplicateCheckEnabled: true,
        contentFilteringEnabled: true,
        geocodingEnabled: true
      },
      monitoring: {
        logLevel: 'info',
        metricsEnabled: true,
        alertsEnabled: false
      }
    };
    
    const configPath = path.join(this.baseDir, 'data', 'ingestion-config.json');
    fs.writeFileSync(configPath, JSON.stringify(ingestionConfig, null, 2));
    await this.log('✅ Created ingestion configuration');
    
    // Create monitoring configuration
    const monitoringConfig = {
      healthChecks: {
        enabled: true,
        interval: 300000, // 5 minutes
        endpoints: [
          'rss-sources',
          'translation-service',
          'database-connection',
          'geocoding-service'
        ]
      },
      metrics: {
        enabled: true,
        retentionDays: 30,
        aggregationInterval: 3600000 // 1 hour
      },
      alerts: {
        enabled: false,
        thresholds: {
          errorRate: 0.1,
          processingDelay: 1800000, // 30 minutes
          duplicateRate: 0.8
        }
      }
    };
    
    const monitoringPath = path.join(this.baseDir, 'data', 'monitoring-config.json');
    fs.writeFileSync(monitoringPath, JSON.stringify(monitoringConfig, null, 2));
    await this.log('✅ Created monitoring configuration');
  }

  async testConnections() {
    await this.log('Testing connections...');
    
    // Test Supabase connection
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      const { data, error } = await supabase
        .from('events')
        .select('count(*)')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      await this.log('✅ Supabase connection successful');
    } catch (error) {
      await this.log(`❌ Supabase connection failed: ${error.message}`);
      throw error;
    }
    
    // Test OpenAI connection
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 5
      });
      
      if (response.choices && response.choices.length > 0) {
        await this.log('✅ OpenAI connection successful');
      } else {
        throw new Error('Invalid response from OpenAI');
      }
    } catch (error) {
      await this.log(`❌ OpenAI connection failed: ${error.message}`);
      throw error;
    }
  }

  async createExecutableScripts() {
    await this.log('Making scripts executable...');
    
    const scripts = [
      'global-rss-fetcher.js',
      'translation-pipeline.js',
      'batch-processor.js',
      'ingest-news.js',
      'setup-mass-ingestion.js'
    ];
    
    for (const script of scripts) {
      const scriptPath = path.join(__dirname, script);
      if (fs.existsSync(scriptPath)) {
        try {
          await execAsync(`chmod +x ${scriptPath}`);
          await this.log(`✅ Made executable: ${script}`);
        } catch (error) {
          await this.log(`⚠️  Could not make executable: ${script}`);
        }
      }
    }
  }

  async generateUsageGuide() {
    await this.log('Generating usage guide...');
    
    const guide = `# Mass News Ingestion System - Usage Guide

## Overview
This system processes thousands of articles daily from 200+ global news sources across 15+ languages.

## Quick Start

### 1. Environment Setup
Make sure these environment variables are set:
- OPENAI_API_KEY: Your OpenAI API key
- NEXT_PUBLIC_SUPABASE_URL: Your Supabase URL
- SUPABASE_SERVICE_KEY: Your Supabase service key

### 2. Full Pipeline (Recommended)
\`\`\`bash
# Run complete pipeline: fetch RSS + translate + process
node scripts/batch-processor.js full
\`\`\`

### 3. Individual Operations

#### RSS Fetching Only
\`\`\`bash
# Fetch all sources
node scripts/global-rss-fetcher.js all

# Fetch specific language
node scripts/global-rss-fetcher.js language ru

# Fetch specific category
node scripts/global-rss-fetcher.js category defense_intelligence

# Fetch high-priority sources only
node scripts/global-rss-fetcher.js high-priority
\`\`\`

#### Translation Only
\`\`\`bash
# Translate articles from RSS fetch results
node scripts/translation-pipeline.js data/rss-ingestion/global-rss-fetch-*.json
\`\`\`

#### Database Ingestion
\`\`\`bash
# Process translated articles
node scripts/ingest-news.js --batch-file data/translated-articles/translated-articles-*.json

# Process RSS results directly (English only)
node scripts/ingest-news.js --batch-file data/rss-ingestion/global-rss-fetch-*.json
\`\`\`

## System Architecture

### Data Flow
1. **RSS Fetching**: Parallel processing of 200+ sources
2. **Translation**: Multi-language content translated to English
3. **Processing**: AI-powered event extraction and deduplication
4. **Storage**: Events stored in Supabase with geolocation

### File Structure
- \`data/rss-ingestion/\`: Raw RSS fetch results
- \`data/translated-articles/\`: Translated content
- \`data/translation-cache/\`: Translation cache for efficiency
- \`data/batch-output/\`: Processing reports and logs
- \`data/temp/\`: Temporary processing files

## Performance Tuning

### For High Volume
- Increase \`maxConcurrentJobs\` in batch-processor.js
- Adjust \`batchSize\` in translation-pipeline.js
- Monitor rate limits for OpenAI API

### For Quality
- Reduce \`contentFilteringThreshold\` in classifyContent.js
- Enable additional deduplication checks
- Implement custom geocoding for specific regions

## Monitoring

### Health Checks
\`\`\`bash
# Check system health
node scripts/monitor-pipeline-health.js
\`\`\`

### Metrics
- RSS sources success rate
- Translation accuracy
- Event deduplication rate
- Processing throughput

## Troubleshooting

### Common Issues
1. **Rate Limits**: Reduce concurrent requests
2. **Translation Errors**: Check OpenAI API key and quota
3. **Database Errors**: Verify Supabase connection
4. **Memory Issues**: Process smaller batches

### Logs
Check logs in \`data/logs/\` for detailed error information.

## Scaling Considerations

### Horizontal Scaling
- Run multiple instances with different source sets
- Implement Redis for distributed caching
- Use message queues for job coordination

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Enable connection pooling

## API Integration

The system can be extended with:
- REST API for job management
- WebSocket for real-time updates
- Metrics dashboard
- Alert system integration

## Support

For issues or questions:
1. Check logs in \`data/logs/\`
2. Review configuration in \`data/ingestion-config.json\`
3. Monitor system health with health check scripts
`;

    const guidePath = path.join(this.baseDir, 'MASS_INGESTION_GUIDE.md');
    fs.writeFileSync(guidePath, guide);
    await this.log('✅ Generated usage guide: MASS_INGESTION_GUIDE.md');
  }

  async run() {
    try {
      await this.log('🚀 Starting mass ingestion system setup...');
      
      await this.createDirectories();
      await this.checkEnvironment();
      await this.checkDependencies();
      await this.createConfigFiles();
      await this.testConnections();
      await this.createExecutableScripts();
      await this.generateUsageGuide();
      
      await this.log('✅ Mass ingestion system setup completed successfully!');
      await this.log('');
      await this.log('🎉 Ready to process thousands of articles daily!');
      await this.log('');
      await this.log('Next steps:');
      await this.log('1. Read MASS_INGESTION_GUIDE.md for usage instructions');
      await this.log('2. Run: node scripts/batch-processor.js full');
      await this.log('3. Monitor progress in data/batch-output/');
      
    } catch (error) {
      await this.log(`❌ Setup failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new MassIngestionSetup();
  setup.run();
}

module.exports = MassIngestionSetup;