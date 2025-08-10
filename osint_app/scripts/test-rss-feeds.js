#!/usr/bin/env node

/**
 * Test RSS feed connectivity and identify non-functioning sources
 * Checks each feed URL for accessibility and valid RSS format
 */

const axios = require('axios');
const Parser = require('rss-parser');
const { GLOBAL_NEWS_SOURCES, getAllSources } = require('../osint-ingestion/sources/global-news-sources');

// Configuration
const TIMEOUT = 10000; // 10 seconds
const BATCH_SIZE = 10; // Process feeds in batches

class RSSFeedTester {
  constructor() {
    this.parser = new Parser({
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    
    this.results = {
      working: [],
      failed: [],
      timeout: [],
      invalid: []
    };
  }

  async testFeed(source) {
    const startTime = Date.now();
    
    try {
      // First try to fetch with axios to check connectivity
      const response = await axios.get(source.url, {
        timeout: TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        maxRedirects: 5
      });
      
      // Then parse as RSS
      const feed = await this.parser.parseString(response.data);
      
      const responseTime = Date.now() - startTime;
      
      return {
        url: source.url,
        category: source.category,
        language: source.language,
        status: 'working',
        responseTime,
        itemCount: feed.items?.length || 0,
        title: feed.title || 'No title',
        lastBuildDate: feed.lastBuildDate || feed.pubDate || 'Unknown'
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          url: source.url,
          category: source.category,
          language: source.language,
          status: 'timeout',
          responseTime,
          error: 'Request timeout'
        };
      } else if (error.response?.status) {
        return {
          url: source.url,
          category: source.category,
          language: source.language,
          status: 'failed',
          responseTime,
          httpStatus: error.response.status,
          error: `HTTP ${error.response.status}: ${error.response.statusText}`
        };
      } else if (error.message?.includes('Non-whitespace before first tag')) {
        return {
          url: source.url,
          category: source.category,
          language: source.language,
          status: 'invalid',
          responseTime,
          error: 'Invalid RSS format'
        };
      } else {
        return {
          url: source.url,
          category: source.category,
          language: source.language,
          status: 'failed',
          responseTime,
          error: error.message
        };
      }
    }
  }

  async testBatch(sources) {
    const promises = sources.map(source => this.testFeed(source));
    return await Promise.all(promises);
  }

  async testAllFeeds() {
    const allSources = getAllSources();
    console.log(`Testing ${allSources.length} RSS feeds...`);
    console.log('This may take several minutes...\n');
    
    // Process in batches
    for (let i = 0; i < allSources.length; i += BATCH_SIZE) {
      const batch = allSources.slice(i, i + BATCH_SIZE);
      const results = await this.testBatch(batch);
      
      // Categorize results
      results.forEach(result => {
        switch (result.status) {
          case 'working':
            this.results.working.push(result);
            break;
          case 'timeout':
            this.results.timeout.push(result);
            break;
          case 'invalid':
            this.results.invalid.push(result);
            break;
          case 'failed':
            this.results.failed.push(result);
            break;
        }
      });
      
      // Progress update
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, allSources.length)}/${allSources.length} feeds tested`);
    }
    
    this.printResults();
  }

  printResults() {
    const total = this.results.working.length + this.results.failed.length + 
                  this.results.timeout.length + this.results.invalid.length;
    
    console.log('\n' + '='.repeat(80));
    console.log('RSS FEED CONNECTIVITY TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log('\n1. SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total feeds tested: ${total}`);
    console.log(`Working: ${this.results.working.length} (${(this.results.working.length/total*100).toFixed(1)}%)`);
    console.log(`Failed: ${this.results.failed.length} (${(this.results.failed.length/total*100).toFixed(1)}%)`);
    console.log(`Timeout: ${this.results.timeout.length} (${(this.results.timeout.length/total*100).toFixed(1)}%)`);
    console.log(`Invalid RSS: ${this.results.invalid.length} (${(this.results.invalid.length/total*100).toFixed(1)}%)`);
    
    // Category breakdown
    console.log('\n2. STATUS BY CATEGORY');
    console.log('-'.repeat(40));
    const categoryStats = {};
    
    [...this.results.working, ...this.results.failed, ...this.results.timeout, ...this.results.invalid]
      .forEach(result => {
        if (!categoryStats[result.category]) {
          categoryStats[result.category] = { working: 0, failed: 0, timeout: 0, invalid: 0 };
        }
        categoryStats[result.category][result.status]++;
      });
    
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const total = stats.working + stats.failed + stats.timeout + stats.invalid;
      console.log(`\n${category}:`);
      console.log(`  Working: ${stats.working}/${total} (${(stats.working/total*100).toFixed(1)}%)`);
      if (stats.failed > 0) console.log(`  Failed: ${stats.failed}`);
      if (stats.timeout > 0) console.log(`  Timeout: ${stats.timeout}`);
      if (stats.invalid > 0) console.log(`  Invalid: ${stats.invalid}`);
    });
    
    // Failed feeds details
    if (this.results.failed.length > 0) {
      console.log('\n3. FAILED FEEDS');
      console.log('-'.repeat(40));
      this.results.failed.forEach(feed => {
        console.log(`\n${feed.category} - ${feed.url}`);
        console.log(`  Error: ${feed.error}`);
      });
    }
    
    // Timeout feeds
    if (this.results.timeout.length > 0) {
      console.log('\n4. TIMEOUT FEEDS');
      console.log('-'.repeat(40));
      this.results.timeout.forEach(feed => {
        console.log(`${feed.category} - ${feed.url}`);
      });
    }
    
    // Invalid RSS feeds
    if (this.results.invalid.length > 0) {
      console.log('\n5. INVALID RSS FORMAT');
      console.log('-'.repeat(40));
      this.results.invalid.forEach(feed => {
        console.log(`${feed.category} - ${feed.url}`);
      });
    }
    
    // Performance stats for working feeds
    console.log('\n6. PERFORMANCE STATS (Working Feeds)');
    console.log('-'.repeat(40));
    const responseTimes = this.results.working.map(f => f.responseTime);
    if (responseTimes.length > 0) {
      console.log(`Average response time: ${(responseTimes.reduce((a,b) => a+b, 0) / responseTimes.length).toFixed(0)}ms`);
      console.log(`Fastest: ${Math.min(...responseTimes)}ms`);
      console.log(`Slowest: ${Math.max(...responseTimes)}ms`);
    }
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `rss-feed-test-results-${timestamp}.json`;
    require('fs').writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\nDetailed results saved to: ${filename}`);
  }
}

// Run the test
const tester = new RSSFeedTester();
tester.testAllFeeds().catch(console.error);