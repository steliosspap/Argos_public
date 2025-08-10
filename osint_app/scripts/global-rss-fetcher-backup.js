#!/usr/bin/env node

/**
 * Enhanced RSS fetcher for massive multi-language data ingestion
 * Processes 200+ global RSS feeds with translation capabilities
 * Designed for high-volume parallel processing
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
    
    // Cache for sources module
    this.sourcesModule = null;
  }

  async loadSources() {
    if (!this.sourcesModule) {
      this.sourcesModule = await import('../osint-ingestion/sources/global-news-sources.js');
    }
    return this.sourcesModule;
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
        
        if (attempt < maxRetries) {
          await this.sleep(RETRY_DELAY * attempt);
        } else {
          throw error;
        }
      }
    }
  }

  async processSingleSource(source) {
    const { url, category, language, needsTranslation } = source;
    
    try {
      const feed = await this.fetchWithRetry(url);
      
      const articles = (feed.items || []).map(item => ({
        title: item.title || '',
        description: item.contentSnippet || item.description || '',
        content: item.content || item.contentSnippet || item.description || '',
        url: item.link || '',
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        source: feed.title || url,
        sourceUrl: url,
        category,
        language,
        needsTranslation,
        rawItem: item
      }));

      this.stats.successful++;
      this.stats.totalArticles += articles.length;
      this.stats.processedLanguages.add(language);
      
      if (needsTranslation) {
        this.stats.articlesNeedingTranslation += articles.length;
      }

      this.results.sourceStats[url] = {
        success: true,
        articlesCount: articles.length,
        language,
        category,
        lastFetched: new Date().toISOString()
      };

      console.log(`✓ ${url} - ${articles.length} articles (${language})`);
      return articles;
      
    } catch (error) {
      this.stats.failed++;
      this.results.errors.push({
        url,
        category,
        language,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      this.results.sourceStats[url] = {
        success: false,
        error: error.message,
        language,
        category,
        lastAttempted: new Date().toISOString()
      };

      console.error(`✗ ${url} - Error: ${error.message}`);
      return [];
    }
  }

  async processSourcesBatch(sources) {
    const results = [];
    
    // Process sources in batches to avoid overwhelming servers
    for (let i = 0; i < sources.length; i += MAX_CONCURRENT_REQUESTS) {
      const batch = sources.slice(i, i + MAX_CONCURRENT_REQUESTS);
      
      console.log(`Processing batch ${Math.floor(i / MAX_CONCURRENT_REQUESTS) + 1}/${Math.ceil(sources.length / MAX_CONCURRENT_REQUESTS)} (${batch.length} sources)`);
      
      const batchPromises = batch.map(source => this.processSingleSource(source));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          console.error(`Batch error for ${batch[index].url}:`, result.reason);
        }
      });
      
      // Rate limiting between batches
      if (i + MAX_CONCURRENT_REQUESTS < sources.length) {
        await this.sleep(RATE_LIMIT_DELAY);
      }
    }
    
    return results;
  }

  async fetchAllSources() {
    console.log('🌍 Starting global RSS ingestion...');
    
    const sources = await this.loadSources();
    const allSources = sources.getAllSources();
    this.stats.totalSources = allSources.length;
    
    console.log(`📡 Processing ${allSources.length} sources across ${new Set(allSources.map(s => s.language)).size} languages`);
    
    const startTime = Date.now();
    const articles = await this.processSourcesBatch(allSources);
    const endTime = Date.now();
    
    this.results.articles = articles;
    
    // Final statistics
    const duration = (endTime - startTime) / 1000;
    console.log('\n📊 INGESTION COMPLETE');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📡 Sources processed: ${this.stats.totalSources}`);
    console.log(`✓ Successful: ${this.stats.successful}`);
    console.log(`✗ Failed: ${this.stats.failed}`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    console.log(`🌐 Articles needing translation: ${this.stats.articlesNeedingTranslation}`);
    console.log(`🗣️  Languages processed: ${Array.from(this.stats.processedLanguages).join(', ')}`);
    console.log(`📈 Average articles per source: ${(this.stats.totalArticles / this.stats.successful).toFixed(1)}`);
    
    return this.results;
  }

  async fetchByLanguage(language) {
    console.log(`🌍 Fetching sources for language: ${language}`);
    
    const sourcesModule = await this.loadSources();
    const sources = sourcesModule.getSourcesByLanguage(language);
    this.stats.totalSources = sources.length;
    
    console.log(`📡 Processing ${sources.length} ${language} sources`);
    
    const startTime = Date.now();
    const articles = await this.processSourcesBatch(sources);
    const endTime = Date.now();
    
    this.results.articles = articles;
    
    const duration = (endTime - startTime) / 1000;
    console.log(`\n📊 ${language.toUpperCase()} INGESTION COMPLETE`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    
    return this.results;
  }

  async fetchByCategory(category) {
    console.log(`🌍 Fetching sources for category: ${category}`);
    
    const sourcesModule = await this.loadSources();
    const sources = sourcesModule.GLOBAL_NEWS_SOURCES[category] || [];
    if (sources.length === 0) {
      console.log(`No sources found for category: ${category}`);
      return this.results;
    }
    
    const sourcesWithMetadata = sources.map(url => ({
      url,
      category,
      language: 'en', // Most categories are English
      needsTranslation: false
    }));
    
    this.stats.totalSources = sourcesWithMetadata.length;
    
    const startTime = Date.now();
    const articles = await this.processSourcesBatch(sourcesWithMetadata);
    const endTime = Date.now();
    
    this.results.articles = articles;
    
    const duration = (endTime - startTime) / 1000;
    console.log(`\n📊 ${category.toUpperCase()} INGESTION COMPLETE`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📄 Total articles: ${this.stats.totalArticles}`);
    
    return this.results;
  }

  async saveResults(outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `global-rss-fetch-${timestamp}.json`;
    const fullPath = path.join(outputPath, filename);
    
    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalSources: this.stats.totalSources,
        successful: this.stats.successful,
        failed: this.stats.failed,
        totalArticles: this.stats.totalArticles,
        articlesNeedingTranslation: this.stats.articlesNeedingTranslation,
        processedLanguages: Array.from(this.stats.processedLanguages)
      },
      articles: this.results.articles,
      errors: this.results.errors,
      sourceStats: this.results.sourceStats
    };
    
    fs.writeFileSync(fullPath, JSON.stringify(output, null, 2));
    console.log(`💾 Results saved to: ${fullPath}`);
    
    return fullPath;
  }

  // Get articles that need translation
  getArticlesForTranslation() {
    return this.results.articles.filter(article => article.needsTranslation);
  }

  // Get articles by language
  getArticlesByLanguage(language) {
    return this.results.articles.filter(article => article.language === language);
  }

  // Get high-priority articles (defense, intelligence, conflict)
  getHighPriorityArticles() {
    const highPriorityCategories = [
      'defense_intelligence',
      'conflict_monitoring',
      'middle_east',
      'eastern_europe'
    ];
    
    return this.results.articles.filter(article => 
      highPriorityCategories.includes(article.category)
    );
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
          
        case 'language':
          if (!param) {
            console.error('Usage: node global-rss-fetcher.js language <language_code>');
            process.exit(1);
          }
          results = await fetcher.fetchByLanguage(param);
          break;
          
        case 'category':
          if (!param) {
            console.error('Usage: node global-rss-fetcher.js category <category_name>');
            process.exit(1);
          }
          results = await fetcher.fetchByCategory(param);
          break;
          
        case 'high-priority':
          // Fetch high-priority categories
          const highPriorityCategories = [
            'international',
            'defense_intelligence', 
            'conflict_monitoring',
            'middle_east',
            'eastern_europe'
          ];
          
          results = { articles: [], errors: [], sourceStats: {} };
          
          for (const category of highPriorityCategories) {
            console.log(`\n🔥 Processing high-priority category: ${category}`);
            const categoryResults = await fetcher.fetchByCategory(category);
            results.articles.push(...categoryResults.articles);
            results.errors.push(...categoryResults.errors);
            Object.assign(results.sourceStats, categoryResults.sourceStats);
          }
          
          fetcher.results = results;
          break;
          
        default:
          console.log('Global RSS Fetcher - Argos Intelligence Platform');
          console.log('');
          console.log('Usage:');
          console.log('  node global-rss-fetcher.js all                    # Fetch all sources');
          console.log('  node global-rss-fetcher.js language <lang>        # Fetch by language (ru, zh, ar, etc.)');
          console.log('  node global-rss-fetcher.js category <category>    # Fetch by category');
          console.log('  node global-rss-fetcher.js high-priority          # Fetch high-priority sources only');
          console.log('');
          console.log('Available languages: en, ru, zh, ar, es, fr, de, it, pt, ja');
          
          // Load sources to show available categories
          try {
            const sourcesModule = await import('../osint-ingestion/sources/global-news-sources.js');
            console.log('Available categories:', Object.keys(sourcesModule.GLOBAL_NEWS_SOURCES).join(', '));
          } catch (error) {
            console.log('Available categories: (unable to load)');
          }
          process.exit(0);
      }
      
      // Save results
      const outputDir = path.join(__dirname, '..', 'data', 'rss-ingestion');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      await fetcher.saveResults(outputDir);
      
      // Display summary of articles needing translation
      const translationArticles = fetcher.getArticlesForTranslation();
      if (translationArticles.length > 0) {
        console.log(`\n🔄 ${translationArticles.length} articles need translation`);
        
        const languageBreakdown = {};
        translationArticles.forEach(article => {
          languageBreakdown[article.language] = (languageBreakdown[article.language] || 0) + 1;
        });
        
        console.log('Translation needed by language:');
        Object.entries(languageBreakdown).forEach(([lang, count]) => {
          console.log(`  ${lang}: ${count} articles`);
        });
      }
      
      process.exit(0);
      
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = GlobalRSSFetcher;