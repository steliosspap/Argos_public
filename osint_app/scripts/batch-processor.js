#!/usr/bin/env node

/**
 * Batch Processing System for High-Volume News Ingestion
 * Orchestrates RSS fetching, translation, and database ingestion
 * Designed for processing thousands of articles from global sources
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
// Note: GlobalRSSFetcher will be loaded dynamically to avoid ES module issues
const TranslationPipeline = require('./translation-pipeline');

class BatchProcessor {
  constructor(options = {}) {
    this.options = {
      maxConcurrentJobs: options.maxConcurrentJobs || 3,
      translationService: options.translationService || 'openai',
      enableTranslation: options.enableTranslation !== false,
      enableIngestion: options.enableIngestion !== false,
      tempDir: options.tempDir || path.join(__dirname, '..', 'data', 'temp'),
      outputDir: options.outputDir || path.join(__dirname, '..', 'data', 'batch-output'),
      retryFailedJobs: options.retryFailedJobs !== false,
      cleanupTemp: options.cleanupTemp !== false,
      ...options
    };

    this.jobs = [];
    this.stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalArticles: 0,
      translatedArticles: 0,
      ingestedArticles: 0,
      startTime: null,
      endTime: null
    };

    // Ensure directories exist
    [this.options.tempDir, this.options.outputDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'inherit',
        ...options
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Job definitions
  createRSSFetchJob(type, param = null) {
    return {
      id: `rss-fetch-${type}-${param || 'all'}-${Date.now()}`,
      type: 'rss-fetch',
      command: 'node',
      args: [
        path.join(__dirname, 'global-rss-fetcher.js'),
        type,
        ...(param ? [param] : [])
      ],
      description: `Fetch RSS feeds: ${type}${param ? ` (${param})` : ''}`,
      priority: type === 'high-priority' ? 1 : 2,
      status: 'pending',
      outputFile: null,
      error: null
    };
  }

  createTranslationJob(inputFile) {
    return {
      id: `translation-${Date.now()}`,
      type: 'translation',
      command: 'node',
      args: [
        path.join(__dirname, 'translation-pipeline.js'),
        inputFile,
        this.options.translationService
      ],
      description: `Translate articles from ${path.basename(inputFile)}`,
      priority: 3,
      status: 'pending',
      inputFile,
      outputFile: null,
      error: null
    };
  }

  createIngestionJob(inputFile) {
    return {
      id: `ingestion-${Date.now()}`,
      type: 'ingestion',
      command: 'node',
      args: [
        path.join(__dirname, 'ingest-news.js'),
        '--batch-file',
        inputFile
      ],
      description: `Ingest articles from ${path.basename(inputFile)}`,
      priority: 4,
      status: 'pending',
      inputFile,
      outputFile: null,
      error: null
    };
  }

  async executeJob(job) {
    console.log(`🚀 Starting job: ${job.description}`);
    job.status = 'running';
    job.startTime = new Date().toISOString();

    try {
      // Set working directory
      const workingDir = path.dirname(__filename);
      
      await this.runCommand(job.command, job.args, {
        cwd: workingDir,
        env: process.env
      });

      job.status = 'completed';
      job.endTime = new Date().toISOString();
      
      // Find output file based on job type
      if (job.type === 'rss-fetch') {
        const rssOutputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
        if (fs.existsSync(rssOutputDir)) {
          const files = fs.readdirSync(rssOutputDir)
            .filter(f => f.startsWith('global-rss-fetch-'))
            .map(f => ({
              name: f,
              path: path.join(rssOutputDir, f),
              time: fs.statSync(path.join(rssOutputDir, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);
          
          if (files.length > 0) {
            job.outputFile = files[0].path;
          }
        }
      } else if (job.type === 'translation') {
        const translationOutputDir = path.join(__dirname, '..', 'data', 'translated-articles');
        if (fs.existsSync(translationOutputDir)) {
          const files = fs.readdirSync(translationOutputDir)
            .filter(f => f.startsWith('translated-articles-'))
            .map(f => ({
              name: f,
              path: path.join(translationOutputDir, f),
              time: fs.statSync(path.join(translationOutputDir, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);
          
          if (files.length > 0) {
            job.outputFile = files[0].path;
          }
        }
      }

      console.log(`✅ Job completed: ${job.description}`);
      this.stats.completedJobs++;
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date().toISOString();
      
      console.error(`❌ Job failed: ${job.description} - ${error.message}`);
      this.stats.failedJobs++;
    }
  }

  async processJobQueue() {
    console.log(`📋 Processing ${this.jobs.length} jobs with max ${this.options.maxConcurrentJobs} concurrent jobs`);
    
    const runningJobs = new Map();
    let jobIndex = 0;
    
    while (jobIndex < this.jobs.length || runningJobs.size > 0) {
      // Start new jobs if we have capacity
      while (runningJobs.size < this.options.maxConcurrentJobs && jobIndex < this.jobs.length) {
        const job = this.jobs[jobIndex];
        
        // Check if job dependencies are met
        if (job.type === 'translation' && job.inputFile && !fs.existsSync(job.inputFile)) {
          // Wait for input file to be created
          await this.sleep(1000);
          continue;
        }
        
        const jobPromise = this.executeJob(job);
        runningJobs.set(job.id, jobPromise);
        jobIndex++;
      }
      
      // Wait for any job to complete
      if (runningJobs.size > 0) {
        const promises = Array.from(runningJobs.entries()).map(([id, promise]) => 
          promise.then(() => id).catch(() => id)
        );
        
        const completedJobId = await Promise.race(promises);
        runningJobs.delete(completedJobId);
      }
      
      await this.sleep(100);
    }
  }

  async runFullPipeline() {
    console.log('🌍 Starting full global news ingestion pipeline...');
    
    this.stats.startTime = new Date().toISOString();
    
    // Phase 1: High-priority RSS fetching
    console.log('\n📡 Phase 1: High-priority RSS fetching');
    const highPriorityJob = this.createRSSFetchJob('high-priority');
    this.jobs.push(highPriorityJob);
    
    // Phase 2: Fetch by major languages
    console.log('\n🌐 Phase 2: Multi-language RSS fetching');
    const languages = ['ru', 'zh', 'ar', 'es', 'fr', 'de'];
    languages.forEach(lang => {
      const langJob = this.createRSSFetchJob('language', lang);
      this.jobs.push(langJob);
    });
    
    // Phase 3: Specific categories
    console.log('\n🔍 Phase 3: Specialized categories');
    const categories = ['middle_east', 'eastern_europe', 'asia_pacific', 'africa'];
    categories.forEach(category => {
      const categoryJob = this.createRSSFetchJob('category', category);
      this.jobs.push(categoryJob);
    });
    
    this.stats.totalJobs = this.jobs.length;
    
    // Execute RSS fetching jobs
    await this.processJobQueue();
    
    // Phase 4: Translation (if enabled)
    if (this.options.enableTranslation) {
      console.log('\n🔄 Phase 4: Translation processing');
      
      // Find all RSS output files that need translation
      const rssOutputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
      if (fs.existsSync(rssOutputDir)) {
        const rssFiles = fs.readdirSync(rssOutputDir)
          .filter(f => f.startsWith('global-rss-fetch-'))
          .map(f => path.join(rssOutputDir, f));
        
        // Create translation jobs for each RSS output
        rssFiles.forEach(file => {
          const translationJob = this.createTranslationJob(file);
          this.jobs.push(translationJob);
        });
        
        this.stats.totalJobs = this.jobs.length;
        
        // Execute translation jobs
        await this.processJobQueue();
      }
    }
    
    // Phase 5: Database ingestion (if enabled)
    if (this.options.enableIngestion) {
      console.log('\n💾 Phase 5: Database ingestion');
      
      // Find all translation output files or RSS files if translation is disabled
      let inputFiles = [];
      
      if (this.options.enableTranslation) {
        const translationOutputDir = path.join(__dirname, '..', 'data', 'translated-articles');
        if (fs.existsSync(translationOutputDir)) {
          inputFiles = fs.readdirSync(translationOutputDir)
            .filter(f => f.startsWith('translated-articles-'))
            .map(f => path.join(translationOutputDir, f));
        }
      } else {
        const rssOutputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
        if (fs.existsSync(rssOutputDir)) {
          inputFiles = fs.readdirSync(rssOutputDir)
            .filter(f => f.startsWith('global-rss-fetch-'))
            .map(f => path.join(rssOutputDir, f));
        }
      }
      
      // Create ingestion jobs
      inputFiles.forEach(file => {
        const ingestionJob = this.createIngestionJob(file);
        this.jobs.push(ingestionJob);
      });
      
      this.stats.totalJobs = this.jobs.length;
      
      // Execute ingestion jobs
      await this.processJobQueue();
    }
    
    this.stats.endTime = new Date().toISOString();
    
    // Generate final report
    await this.generateReport();
    
    // Cleanup if requested
    if (this.options.cleanupTemp) {
      console.log('\n🧹 Cleaning up temporary files...');
      // Implementation for cleanup
    }
    
    console.log('\n🎉 Full pipeline completed!');
  }

  async generateReport() {
    const duration = (new Date(this.stats.endTime) - new Date(this.stats.startTime)) / 1000;
    
    console.log('\n📊 BATCH PROCESSING COMPLETE');
    console.log('=' .repeat(50));
    console.log(`⏱️  Total duration: ${duration.toFixed(2)} seconds`);
    console.log(`📋 Total jobs: ${this.stats.totalJobs}`);
    console.log(`✅ Completed jobs: ${this.stats.completedJobs}`);
    console.log(`❌ Failed jobs: ${this.stats.failedJobs}`);
    console.log(`📄 Success rate: ${((this.stats.completedJobs / this.stats.totalJobs) * 100).toFixed(1)}%`);
    
    // Job breakdown
    const jobsByType = {};
    this.jobs.forEach(job => {
      jobsByType[job.type] = (jobsByType[job.type] || 0) + 1;
    });
    
    console.log('\n📋 Job breakdown:');
    Object.entries(jobsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} jobs`);
    });
    
    // Failed jobs
    const failedJobs = this.jobs.filter(job => job.status === 'failed');
    if (failedJobs.length > 0) {
      console.log('\n❌ Failed jobs:');
      failedJobs.forEach(job => {
        console.log(`  - ${job.description}: ${job.error}`);
      });
    }
    
    // Save detailed report
    const reportPath = path.join(this.options.outputDir, `batch-report-${Date.now()}.json`);
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        duration: duration,
        options: this.options
      },
      stats: this.stats,
      jobs: this.jobs
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'full';
  
  async function main() {
    try {
      const processor = new BatchProcessor({
        maxConcurrentJobs: 2, // Conservative to avoid rate limits
        translationService: 'openai',
        enableTranslation: true,
        enableIngestion: false // Disable for now to focus on data collection
      });
      
      switch (mode) {
        case 'full':
          await processor.runFullPipeline();
          break;
          
        case 'rss-only':
          // Just fetch RSS feeds
          processor.options.enableTranslation = false;
          processor.options.enableIngestion = false;
          await processor.runFullPipeline();
          break;
          
        case 'translate-only':
          // Just run translation on existing RSS files
          processor.options.enableIngestion = false;
          await processor.runFullPipeline();
          break;
          
        default:
          console.log('Batch Processor - Argos Intelligence Platform');
          console.log('');
          console.log('Usage:');
          console.log('  node batch-processor.js [mode]');
          console.log('');
          console.log('Modes:');
          console.log('  full         Complete pipeline: RSS + Translation + Ingestion');
          console.log('  rss-only     Fetch RSS feeds only');
          console.log('  translate-only  Translation only (requires existing RSS files)');
          console.log('');
          console.log('Environment Variables:');
          console.log('  OPENAI_API_KEY  Required for translation');
          process.exit(0);
      }
      
    } catch (error) {
      console.error('Batch processing error:', error);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = BatchProcessor;