/**
 * Ingestion Service
 * Orchestrates data collection from multiple sources
 */

import { google } from 'googleapis';
import Parser from 'rss-parser';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import crypto from 'crypto';

import { config } from '../core/config.js';
import { Source, BASELINE_SOURCES } from '../models/Source.js';
import { TextProcessor } from './TextProcessor.js';
import { EventExtractor } from './EventExtractor.js';
import { SocialMediaService } from './SocialMediaService.js';

export class IngestionService {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.limit = options.limit || 100;
    
    // Initialize services
    this.textProcessor = new TextProcessor();
    this.eventExtractor = new EventExtractor();
    this.socialMediaService = new SocialMediaService();
    this.rssParser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OSINTPipeline/1.0)'
      }
    });
    
    // Initialize APIs
    this.customSearch = google.customsearch('v1');
    
    // Initialize database
    if (!this.dryRun) {
      this.supabase = createClient(
        config.database.supabase.url,
        config.database.supabase.serviceKey
      );
    }
    
    // Rate limiting
    this.concurrencyLimit = pLimit(config.ingestion.maxConcurrentRequests);
    
    // Statistics tracking
    this.stats = {
      searched: 0,
      fetched: 0,
      analyzed: 0,
      eventsExtracted: 0,
      errors: []
    };
  }

  /**
   * Main ingestion cycle
   */
  async ingest() {
    console.log('Starting OSINT ingestion cycle...');
    
    try {
      // 1. Initialize or update sources
      await this.initializeSources();
      
      // 2. Generate search queries
      const searchQueries = await this.generateSearchQueries();
      
      // 3. Search and collect articles
      const articles = await this.collectArticles(searchQueries);
      
      // 4. Process articles and extract events
      const events = await this.processArticles(articles);
      
      // 5. Deduplicate and cluster events
      const clusteredEvents = await this.clusterEvents(events);
      
      // 6. Store results
      if (!this.dryRun) {
        await this.storeResults(clusteredEvents);
      }
      
      // 7. Generate alerts for critical events
      await this.generateAlerts(clusteredEvents);
      
      console.log('\nIngestion cycle completed:');
      console.log(`- Articles searched: ${this.stats.searched}`);
      console.log(`- Articles fetched: ${this.stats.fetched}`);
      console.log(`- Articles analyzed: ${this.stats.analyzed}`);
      console.log(`- Events extracted: ${this.stats.eventsExtracted}`);
      console.log(`- Errors: ${this.stats.errors.length}`);
      
      return {
        stats: this.stats,
        events: clusteredEvents
      };
      
    } catch (error) {
      console.error('Ingestion error:', error);
      this.stats.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Initialize sources in database
   */
  async initializeSources() {
    if (this.dryRun) return;
    
    console.log('Initializing sources...');
    
    // Combine all baseline sources
    const allSources = [
      ...BASELINE_SOURCES.institutional,
      ...BASELINE_SOURCES.conflictTrackers,
      ...BASELINE_SOURCES.news
    ];
    
    for (const sourceData of allSources) {
      const source = new Source(sourceData);
      
      // Check if source exists
      const { data: existing } = await this.supabase
        .from('sources')
        .select('*')
        .eq('normalized_name', source.normalizedName)
        .single();
      
      if (!existing) {
        // Insert new source
        const { error } = await this.supabase
          .from('sources')
          .insert(source.toDatabaseFormat());
        
        if (error) {
          console.error(`Error inserting source ${source.name}:`, error);
        } else if (this.verbose) {
          console.log(`Added source: ${source.name}`);
        }
      }
    }
  }

  /**
   * Generate search queries based on current conflicts
   */
  async generateSearchQueries() {
    const queries = [];
    const timeModifiers = ['today', 'latest', 'breaking news', 'last 24 hours'];
    
    // Generate queries for active conflict zones
    for (const zone of config.conflictZones.active) {
      for (const country of zone.countries) {
        // Breaking news queries
        queries.push({
          query: `${country} military conflict ${timeModifiers[Math.floor(Math.random() * timeModifiers.length)]}`,
          type: 'breaking',
          zone: zone.name,
          priority: zone.priority
        });
        
        // Specific event queries
        queries.push({
          query: `${country} casualties killed wounded today`,
          type: 'casualties',
          zone: zone.name,
          priority: zone.priority
        });
        
        queries.push({
          query: `${country} missile strike bombing attack latest`,
          type: 'attack',
          zone: zone.name,
          priority: zone.priority
        });
      }
    }
    
    // Add monitoring zone queries with lower priority
    for (const zone of config.conflictZones.monitoring) {
      queries.push({
        query: `${zone.countries.join(' ')} military tensions ${timeModifiers[0]}`,
        type: 'monitoring',
        zone: zone.name,
        priority: zone.priority
      });
    }
    
    // Add global queries
    queries.push(
      { query: 'military coup attempt today worldwide', type: 'global', priority: 'medium' },
      { query: 'terrorist attack breaking news', type: 'global', priority: 'high' },
      { query: 'UN Security Council emergency meeting conflict', type: 'global', priority: 'medium' }
    );
    
    if (this.verbose) {
      console.log(`Generated ${queries.length} search queries`);
    }
    
    return queries;
  }

  /**
   * Collect articles from multiple sources
   */
  async collectArticles(searchQueries) {
    const allArticles = [];
    
    // 1. Google Custom Search
    const googleArticles = await this.searchGoogle(searchQueries);
    allArticles.push(...googleArticles);
    
    // 2. RSS Feeds
    const rssArticles = await this.fetchRSSFeeds();
    allArticles.push(...rssArticles);
    
    // 3. News APIs (if configured)
    if (config.apis.newsapi.apiKey) {
      const newsApiArticles = await this.fetchNewsAPI();
      allArticles.push(...newsApiArticles);
    }
    
    // Deduplicate articles by URL
    const uniqueArticles = this.deduplicateArticles(allArticles);
    
    console.log(`Collected ${uniqueArticles.length} unique articles from ${allArticles.length} total`);
    
    return uniqueArticles;
  }

  /**
   * Search Google Custom Search API
   */
  async searchGoogle(queries) {
    if (!config.apis.google.apiKey || !config.apis.google.searchEngineId) {
      console.warn('Google Search API not configured');
      return [];
    }
    
    const articles = [];
    const searchPromises = [];
    
    // Limit queries based on priority
    const prioritizedQueries = queries
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 20); // Limit to top 20 queries
    
    for (const queryObj of prioritizedQueries) {
      const searchPromise = this.concurrencyLimit(async () => {
        try {
          const response = await this.customSearch.cse.list({
            auth: config.apis.google.apiKey,
            cx: config.apis.google.searchEngineId,
            q: queryObj.query,
            num: 10,
            dateRestrict: 'd1', // Last 24 hours
            sort: 'date'
          });
          
          this.stats.searched += response.data.items?.length || 0;
          
          if (response.data.items) {
            for (const item of response.data.items) {
              articles.push({
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                source: item.displayLink,
                publishedDate: this.extractDateFromSnippet(item.snippet),
                searchQuery: queryObj.query,
                queryType: queryObj.type,
                conflictZone: queryObj.zone
              });
            }
          }
        } catch (error) {
          console.error(`Search error for "${queryObj.query}":`, error.message);
          this.stats.errors.push(`Search: ${error.message}`);
        }
      });
      
      searchPromises.push(searchPromise);
    }
    
    await Promise.all(searchPromises);
    return articles;
  }

  /**
   * Fetch RSS feeds
   */
  async fetchRSSFeeds() {
    const articles = [];
    const sources = await this.getActiveSources();
    
    const rssPromises = sources
      .filter(source => source.rssUrl && source.shouldFetch())
      .map(source => this.concurrencyLimit(async () => {
        try {
          const feed = await this.rssParser.parseURL(source.rssUrl);
          
          for (const item of feed.items.slice(0, 20)) { // Limit items per feed
            // Check if article is recent
            const pubDate = new Date(item.pubDate || item.isoDate);
            const hoursSincePublished = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
            
            if (hoursSincePublished < 72) { // Within 72 hours
              articles.push({
                title: item.title,
                url: item.link,
                snippet: item.contentSnippet || item.content?.substring(0, 200),
                content: item.content,
                source: source.name,
                sourceId: source.id,
                publishedDate: pubDate,
                categories: item.categories || [],
                queryType: 'rss',
                conflictZone: null
              });
              
              this.stats.fetched++;
            }
          }
          
          // Update source metrics
          if (!this.dryRun) {
            await this.updateSourceMetrics(source.id, true);
          }
        } catch (error) {
          console.error(`RSS error for ${source.name}:`, error.message);
          this.stats.errors.push(`RSS ${source.name}: ${error.message}`);
          
          if (!this.dryRun) {
            await this.updateSourceMetrics(source.id, false);
          }
        }
      }));
    
    await Promise.all(rssPromises);
    return articles;
  }

  /**
   * Fetch from News API
   */
  async fetchNewsAPI() {
    if (!config.apis.newsapi.apiKey) return [];
    
    const articles = [];
    const baseUrl = 'https://newsapi.org/v2/everything';
    
    // News API queries for conflict keywords
    const keywords = [
      'military conflict',
      'war casualties',
      'missile strike',
      'terrorist attack',
      'ceasefire violation'
    ];
    
    for (const keyword of keywords) {
      try {
        const params = new URLSearchParams({
          q: keyword,
          apiKey: config.apis.newsapi.apiKey,
          sortBy: 'publishedAt',
          pageSize: 20,
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        });
        
        const response = await fetch(`${baseUrl}?${params}`);
        const data = await response.json();
        
        if (data.status === 'ok' && data.articles) {
          for (const article of data.articles) {
            articles.push({
              title: article.title,
              url: article.url,
              snippet: article.description,
              content: article.content,
              source: article.source.name,
              publishedDate: new Date(article.publishedAt),
              author: article.author,
              imageUrl: article.urlToImage,
              queryType: 'newsapi',
              searchKeyword: keyword
            });
            
            this.stats.fetched++;
          }
        }
      } catch (error) {
        console.error(`NewsAPI error for "${keyword}":`, error.message);
        this.stats.errors.push(`NewsAPI: ${error.message}`);
      }
    }
    
    return articles;
  }

  /**
   * Get active sources from database
   */
  async getActiveSources() {
    if (this.dryRun) {
      // Return mock sources for dry run
      return BASELINE_SOURCES.news.map(s => new Source(s));
    }
    
    const { data, error } = await this.supabase
      .from('news_sources')
      .select('*')
      .eq('metadata->isActive', true)
      .order('reliability_score', { ascending: false });
    
    if (error) {
      console.error('Error fetching sources:', error);
      return [];
    }
    
    return data.map(row => Source.fromDatabase(row));
  }

  /**
   * Update source metrics
   */
  async updateSourceMetrics(sourceId, success) {
    const { data: source } = await this.supabase
      .from('news_sources')
      .select('*')
      .eq('id', sourceId)
      .single();
    
    if (!source) return;
    
    const sourceObj = Source.fromDatabase(source);
    sourceObj.updateAccessMetrics(success);
    
    const { error } = await this.supabase
      .from('news_sources')
      .update(sourceObj.toDatabaseFormat())
      .eq('id', sourceId);
    
    if (error) {
      console.error('Error updating source metrics:', error);
    }
  }

  /**
   * Process articles and extract events
   */
  async processArticles(articles) {
    const events = [];
    const processPromises = [];
    
    for (const article of articles.slice(0, this.limit)) {
      const processPromise = this.concurrencyLimit(async () => {
        try {
          // Skip if no content
          if (!article.title && !article.snippet && !article.content) {
            return;
          }
          
          // Fetch full content if needed
          if (!article.content && article.url) {
            article.content = await this.fetchArticleContent(article.url);
          }
          
          // Analyze article
          const analysisResult = await this.eventExtractor.analyzeArticle(article);
          
          if (analysisResult.isConflictRelated && analysisResult.events.length > 0) {
            events.push(...analysisResult.events);
            this.stats.eventsExtracted += analysisResult.events.length;
          }
          
          this.stats.analyzed++;
          
        } catch (error) {
          console.error(`Processing error for ${article.url}:`, error.message);
          this.stats.errors.push(`Process: ${error.message}`);
        }
      });
      
      processPromises.push(processPromise);
    }
    
    await Promise.all(processPromises);
    return events;
  }

  /**
   * Fetch article content
   */
  async fetchArticleContent(url) {
    try {
      const response = await fetch(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OSINTPipeline/1.0)'
        }
      });
      
      const html = await response.text();
      
      // Simple content extraction (would use proper library in production)
      const contentMatch = html.match(/<p[^>]*>([^<]+)<\/p>/gi);
      if (contentMatch) {
        return contentMatch
          .map(p => p.replace(/<[^>]+>/g, ''))
          .join(' ')
          .substring(0, 5000);
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Deduplicate articles
   */
  deduplicateArticles(articles) {
    const seen = new Set();
    const unique = [];
    
    for (const article of articles) {
      // Use URL as primary deduplication key
      const key = article.url || this.textProcessor.generateContentHash(article.title + article.snippet);
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(article);
      }
    }
    
    return unique;
  }

  /**
   * Cluster similar events
   */
  async clusterEvents(events) {
    if (events.length === 0) return [];
    
    const clusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < events.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster = {
        primaryEvent: events[i],
        relatedEvents: [],
        confidence: 1.0,
        sourceCount: 1
      };
      
      assigned.add(i);
      
      // Find similar events
      for (let j = i + 1; j < events.length; j++) {
        if (assigned.has(j)) continue;
        
        const similarity = events[i].calculateSimilarity(events[j]);
        
        if (similarity > config.processing.deduplication.similarityThreshold) {
          cluster.relatedEvents.push(events[j]);
          cluster.sourceCount++;
          assigned.add(j);
          
          // Merge events
          events[i].mergeWith(events[j]);
        }
      }
      
      // Update cluster confidence based on corroboration
      cluster.confidence = Math.min(1.0, 0.5 + (cluster.sourceCount * 0.1));
      cluster.primaryEvent.reliability = cluster.confidence;
      
      clusters.push(cluster);
    }
    
    if (this.verbose) {
      console.log(`Clustered ${events.length} events into ${clusters.length} groups`);
    }
    
    return clusters;
  }

  /**
   * Store results in database
   */
  async storeResults(clusters) {
    console.log('Storing results...');
    
    for (const cluster of clusters) {
      const event = cluster.primaryEvent;
      
      // Debug: Log event coordinates before saving
      const dbFormat = event.toDatabaseFormat();
      console.log(`Saving event "${event.title}":`, {
        location: dbFormat.location,
        latitude: dbFormat.latitude,
        longitude: dbFormat.longitude,
        location_name: dbFormat.location_name
      });
      
      // Store event
      const { data: storedEvent, error: eventError } = await this.supabase
        .from('events')
        .insert(dbFormat)
        .select()
        .single();
      
      if (eventError) {
        console.error('Error storing event:', eventError);
        continue;
      }
      
      // Create event group if multiple sources
      if (cluster.relatedEvents.length > 0) {
        // Note: Related events are not stored separately, they're merged into the primary event
        // So we only track the primary event ID
        const eventIds = [storedEvent.id];
        
        const { error: groupError } = await this.supabase
          .from('event_groups')
          .insert({
            event_ids: eventIds,
            primary_event_id: storedEvent.id,
            group_confidence: cluster.confidence,
            corroboration_count: cluster.sourceCount,
            source_diversity_score: cluster.confidence, // Use confidence as diversity score
            bias_distribution: {}, // Empty for now
            average_reliability: event.reliability || 0.5,
            generated_headline: event.enhancedHeadline || event.title
          });
        
        if (groupError) {
          console.error('Error creating event group:', groupError);
          console.error('Group data:', {
            event_ids: eventIds,
            primary_event_id: storedEvent.id,
            group_confidence: cluster.confidence,
            corroboration_count: cluster.sourceCount
          });
        }
      }
    }
  }

  /**
   * Generate alerts for critical events
   */
  async generateAlerts(clusters) {
    if (!config.alerts.enabled) return;
    
    const criticalEvents = clusters
      .filter(c => c.primaryEvent.requiresAlert())
      .map(c => c.primaryEvent);
    
    if (criticalEvents.length === 0) return;
    
    console.log(`Generating alerts for ${criticalEvents.length} critical events`);
    
    for (const event of criticalEvents) {
      // Log alert (would send to Slack/email in production)
      console.log('\n🚨 CRITICAL EVENT ALERT:');
      console.log(`- ${event.enhancedHeadline}`);
      console.log(`- Location: ${event.locationName}, ${event.country}`);
      console.log(`- Time: ${event.timestamp.toISOString()}`);
      console.log(`- Severity: ${event.severity} (Score: ${event.escalationScore}/10)`);
      if (event.casualties.killed) {
        console.log(`- Casualties: ${event.casualties.killed} killed, ${event.casualties.wounded || 0} wounded`);
      }
      console.log(`- Confidence: ${Math.round(event.reliability * 100)}%`);
    }
  }

  /**
   * Extract date from snippet
   */
  extractDateFromSnippet(snippet) {
    if (!snippet) return new Date();
    
    // Look for common date patterns
    const patterns = [
      /(\d{1,2}\s+hours?\s+ago)/i,
      /(\d{1,2}\s+days?\s+ago)/i,
      /(yesterday)/i,
      /(today)/i,
      /(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of patterns) {
      const match = snippet.match(pattern);
      if (match) {
        const timeStr = match[1].toLowerCase();
        const now = new Date();
        
        if (timeStr.includes('hour')) {
          const hours = parseInt(timeStr);
          return new Date(now.getTime() - hours * 60 * 60 * 1000);
        } else if (timeStr.includes('day')) {
          const days = parseInt(timeStr);
          return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        } else if (timeStr === 'yesterday') {
          return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (timeStr === 'today') {
          return now;
        } else {
          // ISO date
          return new Date(timeStr);
        }
      }
    }
    
    return new Date();
  }
}

export default IngestionService;