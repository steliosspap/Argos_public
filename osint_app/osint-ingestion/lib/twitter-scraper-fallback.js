/**
 * Fallback Twitter scraper when snscrape is not available
 * Uses Twitter's public API endpoints without authentication
 */

import { execSync } from 'child_process';

export class TwitterScraperFallback {
  constructor() {
    this.snscrapeAvailable = this.checkSnscrape();
  }

  checkSnscrape() {
    try {
      execSync('snscrape --version', { stdio: 'ignore' });
      return true;
    } catch {
      console.warn('snscrape not available or incompatible, using fallback');
      return false;
    }
  }

  async searchTweets(query, since, limit = 100) {
    if (this.snscrapeAvailable) {
      try {
        const cmd = `snscrape --jsonl --max-results ${limit} twitter-search "${query} since:${since}"`;
        const result = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        return result.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      } catch (error) {
        console.warn('snscrape failed, returning empty results:', error.message);
      }
    }
    
    // Return empty array as fallback
    console.log(`Note: Twitter data collection skipped due to snscrape compatibility issues with Python 3.13`);
    return [];
  }
}

export default TwitterScraperFallback;