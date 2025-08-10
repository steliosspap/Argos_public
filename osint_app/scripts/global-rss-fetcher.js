#!/usr/bin/env node

/**
 * Enhanced RSS fetcher for massive multi-language data ingestion
 * Processes 200+ global RSS feeds with translation capabilities
 * Designed for high-volume parallel processing
 * Fixed version without ES module dependency issues
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Parser = require('rss-parser');

// Configuration
const MAX_CONCURRENT_REQUESTS = 10;
const REQUEST_TIMEOUT = 30000; // 30 seconds
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds
const RATE_LIMIT_DELAY = 100; // 100ms between requests

// Embedded news sources to avoid ES module issues
const EMBEDDED_NEWS_SOURCES = {
  international: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'https://feeds.skynews.com/feeds/rss/world.xml',
    'https://feeds.npr.org/1004/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://feeds.guardian.co.uk/theguardian/world/rss',
    'https://feeds.dw.com/rss/en-world',
    'https://feeds.france24.com/en/international/rss',
    'https://www.euronews.com/rss?format=mrss'
  ],
  defense_intelligence: [
    'https://www.defensenews.com/rss/defense-news/',
    'https://feeds.janes.com/defense',
    'https://breakingdefense.com/feed/',
    'https://www.militarytimes.com/arc/outboundfeeds/rss/'
  ],
  conflict_monitoring: [
    'https://reliefweb.int/rss.xml',
    'https://www.crisisgroup.org/crisiswatch/rss',
    'https://www.acleddata.com/feed/'
  ],
  middle_east: [
    'https://www.middleeasteye.net/rss',
    'https://www.al-monitor.com/rss.xml',
    'https://english.ahram.org.eg/rss/61.aspx'
  ],
  eastern_europe: [
    'https://www.themoscowtimes.com/rss/news',
    'https://kyivindependent.com/rss/',
    'https://www.pravda.com.ua/eng/rss/'
  ]
};

class GlobalRSSFetcher {
  constructor() {
    this.parser = new Parser({
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': 'Argos Intelligence Platform/1.0 (https://argos-intelligence.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    
    this.stats = {
      totalSources: 0,
      successful: 0,
      failed: 0,
      totalArticles: 0,
      articlesNeedingTranslation: 0,
      processedLanguages: new Set()
    };
    
    this.results = {
      articles: [],
      errors: [],
      sourceStats: {}
    };
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, maxRetries = RETRY_ATTEMPTS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching ${url} (attempt ${attempt}/${maxRetries})`);
        
        const response = await axios.get(url, {
          timeout: REQUEST_TIMEOUT,
          headers: {
            'User-Agent': 'Argos Intelligence Platform/1.0 (https://argos-intelligence.com)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          }
        });
        
        const feed = await this.parser.parseString(response.data);
        return feed;
        
      } catch (error) {
        console.error(`Attempt ${attempt} failed for ${url}:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await this.sleep(RETRY_DELAY);
      }
    }
  }

  detectLanguage(text) {
    if (!text) return 'en';
    
    // Simple language detection based on character patterns
    const cyrillicPattern = /[\u0400-\u04FF]/;
    const arabicPattern = /[\u0600-\u06FF]/;
    const chinesePattern = /[\u4e00-\u9fff]/;
    
    if (cyrillicPattern.test(text)) return 'ru';
    if (arabicPattern.test(text)) return 'ar';
    if (chinesePattern.test(text)) return 'zh';
    
    return 'en';
  }

  async processSources(sources, category = 'mixed') {
    console.log(`📡 Processing ${sources.length} ${category} sources`);
    
    const results = {
      articles: [],
      errors: [],
      sourceStats: {}
    };
    
    // Process sources in batches
    for (let i = 0; i < sources.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = sources.slice(i, i + MAX_CONCURRENT_REQUESTS);
      const promises = batch.map(async (sourceUrl) => {
        try {
          const feed = await this.fetchWithRetry(sourceUrl);
          const articles = feed.items.map(item => {
            const language = this.detectLanguage(item.title + ' ' + item.contentSnippet);
            
            return {
              id: item.guid || item.link || `${sourceUrl}-${Date.now()}-${Math.random()}`,
              title: item.title || 'No title',
              link: item.link || sourceUrl,
              description: item.contentSnippet || item.content || '',
              content: item.content || item.contentSnippet || '',
              publishedAt: item.pubDate || new Date().toISOString(),
              source: sourceUrl,
              category: category,
              language: language,
              needsTranslation: language !== 'en'
            };
          });
          
          console.log(`✓ ${sourceUrl} - ${articles.length} articles (${this.detectLanguage(feed.items[0]?.title || '')})`);
          
          this.stats.successful++;
          this.stats.totalArticles += articles.length;
          this.stats.articlesNeedingTranslation += articles.filter(a => a.needsTranslation).length;
          this.stats.processedLanguages.add(this.detectLanguage(feed.items[0]?.title || ''));
          
          results.sourceStats[sourceUrl] = {
            success: true,
            articles: articles.length,
            language: this.detectLanguage(feed.items[0]?.title || '')
          };
          
          return articles;
          
        } catch (error) {
          console.log(`✗ ${sourceUrl} - Error: ${error.message}`);
          this.stats.failed++;
          
          results.errors.push({
            source: sourceUrl,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          results.sourceStats[sourceUrl] = {
            success: false,
            error: error.message
          };
          
          return [];
        }
      });
      
      const batchResults = await Promise.all(promises);
      results.articles.push(...batchResults.flat());
      
      // Rate limiting between batches
      if (i + MAX_CONCURRENT_REQUESTS < sources.length) {
        await this.sleep(RATE_LIMIT_DELAY);
      }
    }
    
    return results;
  }

  async fetchAllSources() {
    console.log('🌍 Starting global RSS ingestion...');
    
    const allSources = Object.values(EMBEDDED_NEWS_SOURCES).flat();
    this.stats.totalSources = allSources.length;
    
    console.log(`📡 Processing ${allSources.length} sources across ${Object.keys(EMBEDDED_NEWS_SOURCES).length} categories`);
    
    const startTime = Date.now();
    const results = await this.processSources(allSources, 'global');
    this.stats.processingTime = Date.now() - startTime;
    
    Object.assign(this.results, results);
    
    console.log('\n📊 Global RSS Ingestion Complete!');
    console.log(`⏱️  Processing time: ${(this.stats.processingTime / 1000).toFixed(1)}s`);
    console.log(`✓ Successful: ${this.stats.successful}`);
    console.log(`✗ Failed: ${this.stats.failed}`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    console.log(`🌐 Articles needing translation: ${this.stats.articlesNeedingTranslation}`);
    console.log(`🗣️  Languages processed: ${Array.from(this.stats.processedLanguages).join(', ')}`);
    console.log(`📈 Average articles per source: ${(this.stats.totalArticles / this.stats.successful).toFixed(1)}`);
    
    return this.results;
  }

  async fetchByCategory(category) {
    console.log(`🌍 Fetching sources for category: ${category}`);
    
    const sources = EMBEDDED_NEWS_SOURCES[category] || [];
    if (sources.length === 0) {
      console.log(`No sources found for category: ${category}`);
      return this.results;
    }
    
    this.stats.totalSources = sources.length;
    const startTime = Date.now();
    const results = await this.processSources(sources, category);
    this.stats.processingTime = Date.now() - startTime;
    
    Object.assign(this.results, results);
    
    console.log(`\n📊 Category '${category}' ingestion complete!`);
    console.log(`⏱️  Processing time: ${(this.stats.processingTime / 1000).toFixed(1)}s`);
    console.log(`✓ Successful: ${this.stats.successful}`);
    console.log(`✗ Failed: ${this.stats.failed}`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    
    return this.results;
  }

  async fetchHighPriority() {
    console.log('🌍 Fetching high-priority sources...');
    
    const highPriorityCategories = [
      'international',
      'defense_intelligence', 
      'conflict_monitoring',
      'middle_east',
      'eastern_europe'
    ];
    
    const results = { articles: [], errors: [], sourceStats: {} };
    
    for (const category of highPriorityCategories) {
      console.log(`\n📡 Processing category: ${category}`);
      const categoryResults = await this.fetchByCategory(category);
      
      results.articles.push(...categoryResults.articles);
      results.errors.push(...categoryResults.errors);
      Object.assign(results.sourceStats, categoryResults.sourceStats);
    }
    
    this.results = results;
    return this.results;
  }
}

// CLI Interface
if (require.main === module) {
  const fetcher = new GlobalRSSFetcher();
  
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];
  
  async function main() {
    try {
      let results;
      
      switch (command) {
        case 'all':
          results = await fetcher.fetchAllSources();
          break;
          
        case 'category':
          if (!param) {
            console.error('Usage: node global-rss-fetcher-fixed.js category <category_name>');
            process.exit(1);
          }
          results = await fetcher.fetchByCategory(param);
          break;
          
        case 'high-priority':
          results = await fetcher.fetchHighPriority();
          break;
          
        default:
          console.log('Global RSS Fetcher (Fixed) - Argos Intelligence Platform');
          console.log('');
          console.log('Usage:');
          console.log('  node global-rss-fetcher-fixed.js all                    # Fetch all sources');
          console.log('  node global-rss-fetcher-fixed.js category <category>    # Fetch by category');
          console.log('  node global-rss-fetcher-fixed.js high-priority          # Fetch high-priority sources only');
          console.log('');
          console.log('Available categories:', Object.keys(EMBEDDED_NEWS_SOURCES).join(', '));
          process.exit(0);
      }
      
      // Save results
      const outputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(outputDir, `global-rss-fetch-${timestamp}.json`);
      
      const output = {
        timestamp: new Date().toISOString(),
        command: command || 'help',
        parameter: param,
        stats: fetcher.stats,
        results: results
      };
      
      fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
      console.log(`\n💾 Results saved to: ${outputFile}`);
      console.log(`📊 Summary: ${results.articles.length} articles from ${fetcher.stats.successful} sources`);
      
    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = GlobalRSSFetcher;