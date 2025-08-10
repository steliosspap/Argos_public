/**
 * Social Media Service
 * Handles ingestion from Twitter and Telegram for conflict monitoring
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventExtractor } from './EventExtractor.js';
import { config } from '../core/config.js';
import crypto from 'crypto';
import TwitterScraperFallback from '../lib/twitter-scraper-fallback.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SocialMediaService {
  constructor() {
    this.eventExtractor = new EventExtractor();
    this.twitterScraper = new TwitterScraperFallback();
    this.conflictZones = [
      { name: 'Ukraine', keywords: ['Kyiv', 'Kharkiv', 'missile', 'drone attack'] },
      { name: 'Gaza', keywords: ['Gaza', 'IDF', 'Hamas', 'airstrike'] },
      { name: 'Syria', keywords: ['Syria', 'Damascus', 'Aleppo', 'strike'] },
      { name: 'Yemen', keywords: ['Yemen', 'Houthi', 'Saudi', 'coalition'] },
      { name: 'Sudan', keywords: ['Sudan', 'Khartoum', 'RSF', 'conflict'] }
    ];
    
    // Track processed tweets to avoid duplicates
    this.processedTweets = new Set();
    this.processedTelegramMessages = new Set();
  }

  /**
   * Collect tweets for current conflicts
   * @param {Object} options - Collection options
   * @returns {Promise<Array>} Collected tweets
   */
  async collectTweets(options = {}) {
    const {
      maxResults = 100,
      hoursBack = 24,
      includeRetweets = false
    } = options;
    
    console.log(`Collecting tweets from last ${hoursBack} hours...`);
    
    const allTweets = [];
    const since = new Date();
    since.setHours(since.getHours() - hoursBack);
    
    for (const zone of this.conflictZones) {
      try {
        const tweets = await this.searchTwitter({
          query: this.buildTwitterQuery(zone, includeRetweets),
          since: since.toISOString().split('T')[0],
          maxResults: Math.floor(maxResults / this.conflictZones.length)
        });
        
        console.log(`  Found ${tweets.length} tweets for ${zone.name}`);
        
        tweets.forEach(tweet => {
          tweet.conflictZone = zone.name;
          allTweets.push(tweet);
        });
        
      } catch (error) {
        console.error(`Failed to collect tweets for ${zone.name}:`, error.message);
      }
    }
    
    return allTweets;
  }

  /**
   * Build Twitter search query
   */
  buildTwitterQuery(zone, includeRetweets) {
    // Build query with keywords and filters
    const keywords = zone.keywords.map(k => `"${k}"`).join(' OR ');
    let query = `(${keywords}) (killed OR wounded OR strike OR attack OR explosion)`;
    
    // Add language filter for better results
    query += ' lang:en OR lang:ar OR lang:uk OR lang:ru';
    
    // Filter out retweets if requested
    if (!includeRetweets) {
      query += ' -is:retweet';
    }
    
    // Only include tweets with some engagement
    query += ' min_retweets:2 OR min_likes:5';
    
    return query;
  }

  /**
   * Search Twitter using snscrape with fallback
   */
  async searchTwitter(params) {
    const { query, since, maxResults } = params;
    
    try {
      // Use the fallback scraper which handles Python 3.13 compatibility
      const tweets = await this.twitterScraper.searchTweets(query, since, maxResults);
      return tweets.map(tweet => this.normalizeTweet(tweet));
    } catch (error) {
      console.error(`Twitter search failed for query "${query}":`, error.message);
      return [];
    }
  }

  /**
   * Normalize tweet data
   */
  normalizeTweet(tweet) {
    return {
      id: tweet.id,
      content: tweet.rawContent || tweet.content,
      author: tweet.user?.username || 'unknown',
      authorName: tweet.user?.displayname || tweet.user?.username,
      timestamp: new Date(tweet.date),
      retweets: tweet.retweetCount || 0,
      likes: tweet.likeCount || 0,
      replies: tweet.replyCount || 0,
      url: tweet.url,
      media: tweet.media || [],
      hashtags: tweet.hashtags || [],
      mentions: tweet.mentionedUsers || [],
      coordinates: tweet.coordinates,
      place: tweet.place,
      source: 'twitter'
    };
  }

  /**
   * Process tweets to extract events
   * @param {Array} tweets - Collected tweets
   * @returns {Promise<Array>} Extracted events
   */
  async processTweets(tweets) {
    console.log(`Processing ${tweets.length} tweets for event extraction...`);
    
    const events = [];
    const processedCount = { new: 0, duplicate: 0, nonConflict: 0 };
    
    for (const tweet of tweets) {
      // Skip if already processed
      if (this.processedTweets.has(tweet.id)) {
        processedCount.duplicate++;
        continue;
      }
      
      this.processedTweets.add(tweet.id);
      
      try {
        // Convert tweet to article format for event extraction
        const article = {
          id: `tweet_${tweet.id}`,
          title: this.extractTweetHeadline(tweet),
          content: tweet.content,
          snippet: tweet.content.substring(0, 200),
          source: `Twitter/@${tweet.author}`,
          publishedDate: tweet.timestamp,
          url: tweet.url,
          metadata: {
            platform: 'twitter',
            engagement: tweet.likes + tweet.retweets * 2,
            author: tweet.author,
            conflictZone: tweet.conflictZone
          }
        };
        
        // Extract events
        const result = await this.eventExtractor.analyzeArticle(article);
        
        if (result.isConflictRelated && result.events.length > 0) {
          // Add social media specific metadata
          result.events.forEach(event => {
            event.source = article.source;
            event.sourceType = 'social_media';
            event.metadata = {
              ...event.metadata,
              platform: 'twitter',
              engagement: article.metadata.engagement,
              tweetId: tweet.id
            };
            
            // Lower confidence for social media
            event.reliability = Math.min(0.6, event.reliability * 0.8);
            event.extractionConfidence *= 0.8;
          });
          
          events.push(...result.events);
          processedCount.new++;
        } else {
          processedCount.nonConflict++;
        }
        
      } catch (error) {
        console.error(`Failed to process tweet ${tweet.id}:`, error.message);
      }
    }
    
    console.log(`Tweet processing complete:`);
    console.log(`  - New events: ${processedCount.new}`);
    console.log(`  - Duplicates skipped: ${processedCount.duplicate}`);
    console.log(`  - Non-conflict: ${processedCount.nonConflict}`);
    console.log(`  - Total events extracted: ${events.length}`);
    
    return events;
  }

  /**
   * Extract headline from tweet content
   */
  extractTweetHeadline(tweet) {
    // Extract key information for headline
    const content = tweet.content;
    
    // Look for casualty numbers
    const casualtyMatch = content.match(/(\d+)\s*(?:killed|dead|died)/i);
    const woundedMatch = content.match(/(\d+)\s*(?:wounded|injured)/i);
    
    // Look for location
    const locationMatch = content.match(/in\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|$)/);
    
    // Look for event type
    const eventMatch = content.match(/(strike|attack|explosion|bombing|shelling)/i);
    
    // Build headline
    const parts = [];
    
    if (tweet.conflictZone) {
      parts.push(tweet.conflictZone);
    }
    
    if (casualtyMatch) {
      parts.push(`${casualtyMatch[1]} killed`);
    }
    
    if (eventMatch) {
      parts.push(eventMatch[1].toLowerCase());
    }
    
    if (locationMatch && !parts.some(p => p.includes(locationMatch[1]))) {
      parts.push(`in ${locationMatch[1].trim()}`);
    }
    
    return parts.length > 0 
      ? parts.join(' ') 
      : content.substring(0, 100) + '...';
  }

  /**
   * Collect Telegram messages
   * @param {Object} options - Collection options
   * @returns {Promise<Array>} Collected messages
   */
  async collectTelegramMessages(options = {}) {
    const {
      channels = [
        'Intel Slava Z',
        'Rybar in English',
        'Middle East Spectator',
        'Gaza Now'
      ],
      hoursBack = 24,
      maxMessages = 100
    } = options;
    
    console.log(`Collecting Telegram messages from ${channels.length} channels...`);
    
    const allMessages = [];
    const since = new Date();
    since.setHours(since.getHours() - hoursBack);
    
    for (const channel of channels) {
      try {
        const messages = await this.searchTelegram({
          channel,
          since,
          limit: Math.floor(maxMessages / channels.length)
        });
        
        console.log(`  Found ${messages.length} messages from ${channel}`);
        allMessages.push(...messages);
        
      } catch (error) {
        console.error(`Failed to collect from ${channel}:`, error.message);
      }
    }
    
    return allMessages;
  }

  /**
   * Search Telegram channel using snscrape
   */
  async searchTelegram(params) {
    return new Promise((resolve, reject) => {
      const { channel, since, limit } = params;
      
      const args = [
        '--jsonl',
        '--max-results', limit.toString(),
        channel.replace(/\s+/g, '')
      ];
      
      const snscrape = spawn('snscrape', ['telegram-channel', ...args], {
        shell: true
      });
      
      let messages = [];
      let stderr = '';
      
      snscrape.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
          try {
            const message = JSON.parse(line);
            if (new Date(message.date) >= since) {
              messages.push(this.normalizeTelegramMessage(message, channel));
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        });
      });
      
      snscrape.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      snscrape.on('close', (code) => {
        if (code !== 0 && messages.length === 0) {
          // Telegram scraping often fails, just return empty array
          resolve([]);
        } else {
          resolve(messages);
        }
      });
      
      snscrape.on('error', (error) => {
        // Don't reject, just return empty array
        resolve([]);
      });
    });
  }

  /**
   * Normalize Telegram message data
   */
  normalizeTelegramMessage(message, channel) {
    return {
      id: message.id || crypto.randomUUID(),
      content: message.content || message.text || '',
      channel: channel,
      timestamp: new Date(message.date),
      views: message.views || 0,
      forwards: message.forwards || 0,
      media: message.media || [],
      url: message.url,
      source: 'telegram'
    };
  }

  /**
   * Clean up old processed items
   */
  cleanupProcessedCache(hoursToKeep = 48) {
    const cutoff = Date.now() - (hoursToKeep * 60 * 60 * 1000);
    
    // This is a simplified cleanup - in production, you'd want to track timestamps
    if (this.processedTweets.size > 10000) {
      this.processedTweets.clear();
    }
    
    if (this.processedTelegramMessages.size > 10000) {
      this.processedTelegramMessages.clear();
    }
  }
}

export default SocialMediaService;