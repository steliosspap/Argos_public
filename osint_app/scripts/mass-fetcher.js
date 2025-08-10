#!/usr/bin/env node

/**
 * Mass RSS fetcher using confirmed working sources
 * Optimized for maximum data volume from reliable sources
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Working RSS sources
const WORKING_RSS_SOURCES = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://feeds.skynews.com/feeds/rss/world.xml',
  'https://feeds.npr.org/1004/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://www.euronews.com/rss?format=mrss',
  'https://feeds.bbci.co.uk/news/business/rss.xml',
  'https://feeds.reuters.com/Reuters/worldNews',
  'https://feeds.washingtonpost.com/rss/national',
  'https://feeds.apnews.com/apnews/topstories',
  'https://rss.cnn.com/rss/cnn_topstories.rss',
  'https://feeds.abcnews.go.com/abcnews/topstories',
  'https://feeds.nbcnews.com/nbcnews/public/world',
  'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'https://feeds.bbci.co.uk/news/politics/rss.xml',
  'https://feeds.bloomberg.com/politics/news.rss',
  'https://feeds.reuters.com/reuters/businessNews',
  'https://feeds.reuters.com/reuters/technologyNews',
  'https://feeds.economist.com/economics/rss.xml',
  'https://feeds.ft.com/rss/international'
];

class MassFetcher {
  constructor() {
    this.stats = {
      totalSources: 0,
      successful: 0,
      failed: 0,
      totalArticles: 0,
      startTime: null,
      endTime: null
    };
    
    this.results = {
      articles: [],
      errors: []
    };
  }

  async fetchURL(url, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const module = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Argos Intelligence Bot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        timeout: timeout,
        rejectUnauthorized: false // Allow self-signed certificates for some feeds
      };
      
      const req = module.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`  🔄 Redirecting to: ${res.headers.location}`);
          return this.fetchURL(res.headers.location, timeout).then(resolve).catch(reject);
        }
        
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

  parseRSS(xmlContent, sourceUrl) {
    const articles = [];
    
    try {
      // Extract feed title
      const feedTitleMatch = xmlContent.match(/<title[^>]*>(.*?)<\/title>/is);
      const feedTitle = feedTitleMatch ? this.cleanText(feedTitleMatch[1]) : 'RSS Feed';
      
      // Simple XML parsing for RSS items
      const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
      const items = xmlContent.match(itemRegex) || [];
      
      console.log(`    Found ${items.length} items in feed`);
      
      items.forEach((item, index) => {
        try {
          const title = this.extractTag(item, 'title');
          const description = this.extractTag(item, 'description') || this.extractTag(item, 'summary');
          const link = this.extractTag(item, 'link');
          const pubDate = this.extractTag(item, 'pubDate') || this.extractTag(item, 'published');
          const guid = this.extractTag(item, 'guid');
          
          if (title && (description || link)) {
            articles.push({
              title: title || '',
              description: description || '',
              content: description || '',
              url: link || '',
              publishedAt: this.parseDate(pubDate) || new Date().toISOString(),
              source: feedTitle,
              sourceUrl: sourceUrl,
              guid: guid || `${sourceUrl}-${index}`,
              category: 'news',
              language: 'en',
              needsTranslation: false
            });
          }
        } catch (err) {
          console.warn(`    ⚠️  Failed to parse item ${index}: ${err.message}`);
        }
      });
      
    } catch (error) {
      console.error(`  ❌ Parse error: ${error.message}`);
    }
    
    return articles;
  }

  extractTag(content, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'is');
    const match = content.match(regex);
    if (match) {
      return this.cleanText(match[1]);
    }
    return '';
  }

  cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove CDATA tags
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return date.toISOString();
    } catch (error) {
      return null;
    }
  }

  async processSingleSource(url, index, total) {
    try {
      console.log(`[${index + 1}/${total}] Fetching ${url}...`);
      const xmlContent = await this.fetchURL(url);
      const articles = this.parseRSS(xmlContent, url);
      
      this.stats.successful++;
      this.stats.totalArticles += articles.length;
      
      console.log(`  ✅ Success: ${articles.length} articles`);
      return articles;
      
    } catch (error) {
      this.stats.failed++;
      this.results.errors.push({
        url,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.log(`  ❌ Failed: ${error.message}`);
      return [];
    }
  }

  async fetchAllSources() {
    console.log('🌍 Starting mass RSS ingestion...');
    console.log(`📡 Processing ${WORKING_RSS_SOURCES.length} confirmed working sources`);
    
    this.stats.totalSources = WORKING_RSS_SOURCES.length;
    this.stats.startTime = Date.now();
    
    const allArticles = [];
    
    // Process sources sequentially to be respectful
    for (let i = 0; i < WORKING_RSS_SOURCES.length; i++) {
      const articles = await this.processSingleSource(WORKING_RSS_SOURCES[i], i, WORKING_RSS_SOURCES.length);
      allArticles.push(...articles);
      
      // Small delay between requests
      if (i < WORKING_RSS_SOURCES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.stats.endTime = Date.now();
    this.results.articles = allArticles;
    
    // Final statistics
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    console.log('\n📊 MASS INGESTION COMPLETE');
    console.log('=' .repeat(50));
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📡 Sources processed: ${this.stats.totalSources}`);
    console.log(`✅ Successful: ${this.stats.successful}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    console.log(`📈 Success rate: ${((this.stats.successful / this.stats.totalSources) * 100).toFixed(1)}%`);
    console.log(`📊 Articles per source: ${(this.stats.totalArticles / this.stats.successful).toFixed(1)}`);
    
    return this.results;
  }

  async saveResults(outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mass-rss-fetch-${timestamp}.json`;
    const fullPath = path.join(outputPath, filename);
    
    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalSources: this.stats.totalSources,
        successful: this.stats.successful,
        failed: this.stats.failed,
        totalArticles: this.stats.totalArticles,
        duration: (this.stats.endTime - this.stats.startTime) / 1000,
        articlesPerSource: this.stats.totalArticles / this.stats.successful
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
  const fetcher = new MassFetcher();
  
  async function main() {
    try {
      // Fetch from all working sources
      const results = await fetcher.fetchAllSources();
      
      // Save results
      const outputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputFile = await fetcher.saveResults(outputDir);
      
      if (results.articles.length > 0) {
        console.log('\n🚀 Ready for processing!');
        console.log(`Next: node scripts/ingest-news.js --batch-file ${outputFile}`);
        
        // Show article distribution by source
        const sourceStats = {};
        results.articles.forEach(article => {
          sourceStats[article.source] = (sourceStats[article.source] || 0) + 1;
        });
        
        console.log('\n📊 Articles by source:');
        Object.entries(sourceStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .forEach(([source, count]) => {
            console.log(`  ${source}: ${count} articles`);
          });
      }
      
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = MassFetcher;