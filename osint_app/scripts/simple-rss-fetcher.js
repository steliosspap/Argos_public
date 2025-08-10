#!/usr/bin/env node

/**
 * Simple RSS fetcher using Node.js built-in modules
 * Fallback implementation without external dependencies
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { GLOBAL_NEWS_SOURCES, getAllSources } = require('../osint-ingestion/sources/global-news-sources');

class SimpleRSSFetcher {
  constructor() {
    this.stats = {
      totalSources: 0,
      successful: 0,
      failed: 0,
      totalArticles: 0
    };
    
    this.results = {
      articles: [],
      errors: []
    };
  }

  async fetchURL(url, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const module = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Argos Intelligence Platform/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: timeout
      };
      
      const req = module.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  parseSimpleRSS(xmlContent) {
    const articles = [];
    
    // Simple XML parsing using regex (not ideal but works for basic RSS)
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const items = xmlContent.match(itemRegex) || [];
    
    items.forEach(item => {
      const title = this.extractTag(item, 'title');
      const description = this.extractTag(item, 'description');
      const link = this.extractTag(item, 'link');
      const pubDate = this.extractTag(item, 'pubDate');
      
      if (title || description) {
        articles.push({
          title: title || '',
          description: description || '',
          content: description || '',
          url: link || '',
          publishedAt: pubDate || new Date().toISOString(),
          source: 'RSS Feed',
          rawItem: item
        });
      }
    });
    
    return articles;
  }

  extractTag(content, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'is');
    const match = content.match(regex);
    if (match) {
      // Remove CDATA tags and decode HTML entities
      return match[1]
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
    return '';
  }

  async processSingleSource(source) {
    const { url, category, language, needsTranslation } = source;
    
    try {
      console.log(`Fetching ${url}...`);
      const xmlContent = await this.fetchURL(url);
      const articles = this.parseSimpleRSS(xmlContent);
      
      const processedArticles = articles.map(article => ({
        ...article,
        sourceUrl: url,
        category,
        language,
        needsTranslation
      }));
      
      this.stats.successful++;
      this.stats.totalArticles += processedArticles.length;
      
      console.log(`✓ ${url} - ${processedArticles.length} articles (${language})`);
      return processedArticles;
      
    } catch (error) {
      this.stats.failed++;
      this.results.errors.push({
        url,
        category,
        language,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(`✗ ${url} - Error: ${error.message}`);
      return [];
    }
  }

  async fetchSampleSources(maxSources = 10) {
    console.log('🌍 Starting sample RSS ingestion...');
    
    // Get a sample of high-priority English sources to start with
    const allSources = getAllSources();
    const englishSources = allSources
      .filter(source => source.language === 'en')
      .slice(0, maxSources);
    
    this.stats.totalSources = englishSources.length;
    
    console.log(`📡 Processing ${englishSources.length} English sources`);
    
    const startTime = Date.now();
    const allArticles = [];
    
    for (const source of englishSources) {
      const articles = await this.processSingleSource(source);
      allArticles.push(...articles);
      
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const endTime = Date.now();
    this.results.articles = allArticles;
    
    // Final statistics
    const duration = (endTime - startTime) / 1000;
    console.log('\n📊 SAMPLE INGESTION COMPLETE');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📡 Sources processed: ${this.stats.totalSources}`);
    console.log(`✓ Successful: ${this.stats.successful}`);
    console.log(`✗ Failed: ${this.stats.failed}`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    
    return this.results;
  }

  async saveResults(outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `simple-rss-fetch-${timestamp}.json`;
    const fullPath = path.join(outputPath, filename);
    
    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalSources: this.stats.totalSources,
        successful: this.stats.successful,
        failed: this.stats.failed,
        totalArticles: this.stats.totalArticles
      },
      articles: this.results.articles,
      errors: this.results.errors
    };
    
    fs.writeFileSync(fullPath, JSON.stringify(output, null, 2));
    console.log(`💾 Results saved to: ${fullPath}`);
    
    return fullPath;
  }
}

// CLI Interface
if (require.main === module) {
  const fetcher = new SimpleRSSFetcher();
  
  async function main() {
    try {
      // Fetch sample sources
      const results = await fetcher.fetchSampleSources(20); // Start with 20 sources
      
      // Save results
      const outputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputFile = await fetcher.saveResults(outputDir);
      
      if (results.articles.length > 0) {
        console.log('\n🚀 Ready for processing!');
        console.log(`Run: node scripts/ingest-news.js --batch-file ${outputFile}`);
      }
      
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = SimpleRSSFetcher;