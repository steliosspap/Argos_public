/**
 * Enhanced Ingestion Service
 * Implements the comprehensive conflict monitoring pipeline
 */

import { IngestionService } from './IngestionService.js';
import { QueryGenerator } from './QueryGenerator.js';
import { NamedEntityRecognition } from './NamedEntityRecognition.js';
import { TemporalAnalyzer } from './TemporalAnalyzer.js';
import { FactValidator } from './FactValidator.js';
import { MediaBiasAnalyzer } from './MediaBiasAnalyzer.js';
import { SimilarityService } from './SimilarityService.js';
import { SocialMediaService } from './SocialMediaService.js';
import { config } from '../core/config.js';
import fetch from 'node-fetch';
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class EnhancedIngestionService extends IngestionService {
  constructor(options = {}) {
    super(options);
    
    // Initialize enhanced services
    this.queryGenerator = new QueryGenerator();
    this.ner = new NamedEntityRecognition();
    this.temporalAnalyzer = new TemporalAnalyzer();
    this.factValidator = new FactValidator();
    this.mediaBiasAnalyzer = new MediaBiasAnalyzer();
    this.similarityService = new SimilarityService();
    this.socialMediaService = new SocialMediaService();
    
    // Initialize media analysis services
    this.initializeMediaAnalysis(options);
    
    // Initialize Google Custom Search
    this.customSearch = google.customsearch('v1');
    
    // Initialize caching
    this.cacheDir = path.join(process.cwd(), '.cache');
    this.searchCache = new Map();
    this.apiCache = new Map();
    this.initializeCache();
    
    // Query deduplication
    this.queryDedupeSet = new Set();
    this.queryResults = new Map();
    
    // Enhanced statistics
    this.enhancedStats = {
      totalQueries: 0,
      rawArticles: 0,
      uniqueArticles: 0,
      entitiesExtracted: 0,
      factsExtracted: 0,
      eventsIdentified: 0,
      eventClusters: 0,
      targetedSearches: 0,
      corroboratedFacts: 0,
      disputedClaims: 0,
      criticalAlerts: 0
    };
  }
  
  /**
   * Initialize media analysis services
   */
  async initializeMediaAnalysis(options) {
    // Only initialize if media analysis is enabled
    this.mediaAnalysisEnabled = options.enableMediaAnalysis !== false;
    
    if (this.mediaAnalysisEnabled) {
      try {
        const { default: MediaAnalysisService } = await import('./media-analysis/index.js');
        const { default: ReverseImageSearchService } = await import('./media-analysis/reverse-image-search.js');
        const { default: SteganographyDetectorService } = await import('./media-analysis/steganography-detector.js');
        
        this.mediaAnalyzer = new MediaAnalysisService({
          enableSteganography: options.enableSteganography || false,
          enableReverseImageSearch: options.enableReverseImageSearch || false,
          pythonPath: options.pythonPath || 'python3',
          tempDir: options.mediaAnalysisTempDir
        });
        
        this.reverseImageSearch = new ReverseImageSearchService({
          headless: true,
          pythonPath: options.pythonPath || 'python3'
        });
        
        this.steganographyDetector = new SteganographyDetectorService({
          autoExtract: options.autoExtractSteganography || false,
          pythonPath: options.pythonPath || 'python3'
        });
        
        console.log('Media analysis services initialized');
      } catch (error) {
        console.error('Failed to initialize media analysis services:', error.message);
        this.mediaAnalysisEnabled = false;
      }
    }
  }
  
  /**
   * Initialize caching system
   */
  async initializeCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.mkdir(path.join(this.cacheDir, 'searches'), { recursive: true });
      await fs.mkdir(path.join(this.cacheDir, 'api'), { recursive: true });
      
      // Load existing cache files
      const searchCacheFile = path.join(this.cacheDir, 'searches', 'cache.json');
      const apiCacheFile = path.join(this.cacheDir, 'api', 'cache.json');
      
      try {
        const searchCache = await fs.readFile(searchCacheFile, 'utf8');
        const searchData = JSON.parse(searchCache);
        Object.entries(searchData).forEach(([key, value]) => {
          // Only load cache entries less than 24 hours old
          if (Date.now() - value.timestamp < 24 * 60 * 60 * 1000) {
            this.searchCache.set(key, value);
          }
        });
      } catch (error) {
        // Cache file doesn't exist yet
      }
      
      try {
        const apiCache = await fs.readFile(apiCacheFile, 'utf8');
        const apiData = JSON.parse(apiCache);
        Object.entries(apiData).forEach(([key, value]) => {
          if (Date.now() - value.timestamp < 24 * 60 * 60 * 1000) {
            this.apiCache.set(key, value);
          }
        });
      } catch (error) {
        // Cache file doesn't exist yet
      }
    } catch (error) {
      console.error('Cache initialization error:', error.message);
    }
  }
  
  /**
   * Save cache to disk
   */
  async saveCache() {
    try {
      const searchCacheFile = path.join(this.cacheDir, 'searches', 'cache.json');
      const apiCacheFile = path.join(this.cacheDir, 'api', 'cache.json');
      
      const searchData = {};
      this.searchCache.forEach((value, key) => {
        searchData[key] = value;
      });
      
      const apiData = {};
      this.apiCache.forEach((value, key) => {
        apiData[key] = value;
      });
      
      await fs.writeFile(searchCacheFile, JSON.stringify(searchData, null, 2));
      await fs.writeFile(apiCacheFile, JSON.stringify(apiData, null, 2));
    } catch (error) {
      console.error('Cache save error:', error.message);
    }
  }
  
  /**
   * Run enhanced ingestion cycle
   */
  async runEnhancedCycle(options = {}) {
    console.log('Starting Enhanced OSINT Ingestion Cycle...\n');
    
    // Store quick mode flag
    this.quickMode = options.quick || false;
    
    try {
      // Phase 1: Primary Data Collection
      console.log('📊 Phase 1: Primary Data Collection');
      const articles = await this.primaryDataCollection();
      
      // Phase 2: Extraction Module Processing
      console.log('\n🔍 Phase 2: Extraction Module Processing');
      const processedArticles = await this.extractionModuleProcessing(articles);
      
      // Phase 3: Event Processing
      console.log('\n🎯 Phase 3: Event Processing');
      const eventGroups = await this.eventProcessing(processedArticles);
      
      // Phase 4: Validation & Analysis
      console.log('\n✅ Phase 4: Validation & Analysis');
      const validatedEvents = await this.validationAnalysis(eventGroups);
      
      // Phase 5: Output Generation
      console.log('\n📢 Phase 5: Output Generation');
      await this.outputGeneration(validatedEvents);
      
      // Report results
      this.reportEnhancedResults(processedArticles);
      
      // Save cache to disk
      await this.saveCache();
      
    } catch (error) {
      console.error('Enhanced ingestion error:', error);
      // Save cache even on error
      await this.saveCache();
      throw error;
    }
  }
  
  /**
   * Search for articles using NewsAPI with Google fallback and caching
   */
  async searchArticles(query) {
    // Check cache first
    const cacheKey = crypto.createHash('md5').update(query).digest('hex');
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      if (this.verbose) console.log(`Using cached results for "${query}"`);
      return cached.articles;
    }
    
    let articles = [];
    
    // Try NewsAPI first
    if (config.apis.newsapi.apiKey) {
      articles = await this.searchNewsAPI(query);
      
      // If NewsAPI fails or returns no results, try Google
      if (articles.length === 0) {
        if (this.verbose) console.log(`NewsAPI returned no results for "${query}", trying Google...`);
        articles = await this.searchGoogle(query);
      }
    } else {
      // No NewsAPI key, go straight to Google
      articles = await this.searchGoogle(query);
    }
    
    // Cache the results
    if (articles.length > 0) {
      this.searchCache.set(cacheKey, {
        articles: articles,
        timestamp: Date.now(),
        query: query
      });
      
      // Save cache periodically
      if (this.searchCache.size % 10 === 0) {
        await this.saveCache();
      }
    }
    
    return articles;
  }
  
  /**
   * Search using NewsAPI
   */
  async searchNewsAPI(query) {
    const articles = [];
    const baseUrl = 'https://newsapi.org/v2/everything';
    
    try {
      const params = new URLSearchParams({
        q: query,
        apiKey: config.apis.newsapi.apiKey,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: this.limit || 5
      });
      
      const response = await fetch(`${baseUrl}?${params}`);
      const data = await response.json();
      
      if (this.verbose && data.status !== 'ok') {
        console.log(`NewsAPI response for "${query}":`, data.status, data.message);
      }
      
      if (data.status === 'ok' && data.articles) {
        for (const article of data.articles) {
          const pubDate = new Date(article.publishedAt);
          const hoursSincePublished = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursSincePublished < 72) {
            articles.push({
              title: article.title,
              url: article.url,
              snippet: article.description || article.content?.substring(0, 200),
              content: article.content,
              source: article.source.name,
              author: article.author,
              publishedDate: pubDate
            });
          }
        }
      }
    } catch (error) {
      console.error(`NewsAPI error for "${query}":`, error.message);
    }
    
    return articles;
  }
  
  /**
   * Search using Google Custom Search API
   */
  async searchGoogle(query) {
    if (!config.apis.google.apiKey || !config.apis.google.searchEngineId) {
      if (this.verbose) console.log('Google Search API not configured');
      return [];
    }
    
    const articles = [];
    
    try {
      const response = await this.customSearch.cse.list({
        auth: config.apis.google.apiKey,
        cx: config.apis.google.searchEngineId,
        q: query + ' news conflict',
        num: this.limit || 5,
        dateRestrict: 'd3', // Last 3 days
        sort: 'date'
      });
      
      if (response.data.items) {
        for (const item of response.data.items) {
          // Extract date from snippet or use current date
          let pubDate = new Date();
          const dateMatch = item.snippet?.match(/(\d{1,2} hours? ago|\d{1,2} days? ago|today|yesterday)/i);
          
          if (dateMatch) {
            const timeStr = dateMatch[0].toLowerCase();
            if (timeStr.includes('hour')) {
              const hours = parseInt(timeStr.match(/\d+/)[0]);
              pubDate = new Date(Date.now() - hours * 60 * 60 * 1000);
            } else if (timeStr.includes('day')) {
              const days = parseInt(timeStr.match(/\d+/)[0]);
              pubDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            } else if (timeStr === 'yesterday') {
              pubDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            }
          }
          
          articles.push({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
            content: item.snippet, // Google doesn't provide full content
            source: new URL(item.link).hostname.replace('www.', ''),
            author: null,
            publishedDate: pubDate
          });
        }
        
        if (this.verbose && articles.length > 0) {
          console.log(`Google returned ${articles.length} results for "${query}"`);
        }
      }
    } catch (error) {
      console.error(`Google search error for "${query}":`, error.message);
    }
    
    return articles;
  }
  
  /**
   * Phase 1: Primary Data Collection
   * Target: ~2,000 raw articles from ~500 queries + social media
   */
  async primaryDataCollection() {
    // Generate comprehensive query set
    let queries = this.queryGenerator.generateAllQueries();
    
    // Limit queries in quick mode
    if (this.quickMode) {
      queries = queries.slice(0, 10); // Only use first 10 queries for testing
    }
    
    this.enhancedStats.totalQueries = queries.length;
    
    console.log(`- Generated ${queries.length} search queries`);
    console.log(`  • Countries: ${queries.filter(q => q.category === 'country').length}`);
    console.log(`  • Regions: ${queries.filter(q => q.category === 'region').length}`);
    console.log(`  • Organizations: ${queries.filter(q => q.category === 'organization').length}`);
    
    // Collect articles with enhanced metadata
    const articles = [];
    let processedQueries = 0;
    const startTime = Date.now();
    
    // Progress tracking
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processedQueries / elapsed;
      const remaining = (queries.length - processedQueries) / rate;
      const progress = (processedQueries / queries.length * 100).toFixed(1);
      process.stdout.write(`\r  Searching: [${processedQueries}/${queries.length}] ${progress}% - ETA: ${Math.round(remaining)}s`);
    }, 500);
    
    // Process queries in batches
    const batchSize = 10;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      
      // Process batch with progress tracking
      await this.processBatch(batch, articles, () => {
        processedQueries++;
      });
      
      // Rate limiting between batches
      if (i + batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    clearInterval(progressInterval);
    console.log(`\r  Searching: [${queries.length}/${queries.length}] 100% - Complete!                    `);
    
    this.enhancedStats.rawArticles = articles.length;
    
    // Collect social media data
    console.log('\n- Collecting social media posts...');
    const socialMediaArticles = await this.collectSocialMediaData();
    
    // Combine all articles
    const allArticles = [...articles, ...socialMediaArticles];
    this.enhancedStats.rawArticles = allArticles.length;
    
    // Deduplicate articles
    const uniqueArticles = this.enhancedDeduplication(allArticles);
    this.enhancedStats.uniqueArticles = uniqueArticles.length;
    
    console.log(`- Collected ${articles.length} news articles`);
    console.log(`- Collected ${socialMediaArticles.length} social media posts`);
    console.log(`- Total: ${allArticles.length} raw articles`);
    console.log(`- Deduplicated to ${uniqueArticles.length} unique articles`);
    
    return uniqueArticles;
  }
  
  /**
   * Process a batch of queries
   */
  async processBatch(queries, articles, onProgress) {
    const batchPromises = queries.map(queryObj => 
      this.concurrencyLimit(async () => {
        try {
          const results = await this.searchArticles(queryObj.query);
          
          // Track query effectiveness
          if (!this.dryRun && this.supabase) {
            await this.supabase
              .from('search_queries')
              .insert({
                query_text: queryObj.query,
                query_type: queryObj.type,
                subject: queryObj.subject,
                modifier: queryObj.modifier,
                results_count: results.length,
                articles_collected: results.length
              });
          }
          
          // Add query metadata to each article
          results.forEach(article => {
            articles.push({
              ...article,
              searchQuery: queryObj,
              collectedAt: new Date()
            });
          });
          
          if (onProgress) onProgress();
          
        } catch (error) {
          console.error(`Query error for "${queryObj.query}":`, error.message);
        }
      })
    );
    
    await Promise.all(batchPromises);
  }
  
  /**
   * Collect social media data
   */
  async collectSocialMediaData() {
    const socialMediaArticles = [];
    
    try {
      // Collect tweets
      const tweets = await this.socialMediaService.collectTweets({
        maxResults: this.quickMode ? 50 : 200,
        hoursBack: 24,
        includeRetweets: false
      });
      
      if (tweets.length > 0) {
        console.log(`  • Collected ${tweets.length} tweets`);
        
        // Convert tweets to article format
        tweets.forEach(tweet => {
          socialMediaArticles.push({
            id: `tweet_${tweet.id}`,
            title: tweet.content.substring(0, 100) + '...',
            url: tweet.url,
            snippet: tweet.content,
            content: tweet.content,
            source: `Twitter/@${tweet.author}`,
            author: tweet.authorName,
            publishedDate: tweet.timestamp,
            collectedAt: new Date(),
            metadata: {
              platform: 'twitter',
              engagement: tweet.likes + tweet.retweets * 2,
              originalData: tweet
            }
          });
        });
      }
      
      // Collect Telegram messages (if not in quick mode)
      if (!this.quickMode) {
        const telegramMessages = await this.socialMediaService.collectTelegramMessages({
          maxMessages: 100,
          hoursBack: 24
        });
        
        if (telegramMessages.length > 0) {
          console.log(`  • Collected ${telegramMessages.length} Telegram messages`);
          
          // Convert to article format
          telegramMessages.forEach(msg => {
            socialMediaArticles.push({
              id: `telegram_${msg.id}`,
              title: msg.content.substring(0, 100) + '...',
              url: msg.url,
              snippet: msg.content,
              content: msg.content,
              source: `Telegram/${msg.channel}`,
              author: msg.channel,
              publishedDate: msg.timestamp,
              collectedAt: new Date(),
              metadata: {
                platform: 'telegram',
                engagement: msg.views + msg.forwards * 2,
                originalData: msg
              }
            });
          });
        }
      }
      
    } catch (error) {
      console.error('Social media collection error:', error.message);
      // Continue with pipeline even if social media fails
    }
    
    return socialMediaArticles;
  }
  
  /**
   * Phase 2: Extraction Module Processing
   */
  async extractionModuleProcessing(articles) {
    const processedArticles = [];
    const processingPromises = [];
    let processedCount = 0;
    const startTime = Date.now();
    
    console.log(`- Processing ${articles.length} articles through extraction modules`);
    
    // Progress tracking
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processedCount / elapsed;
      const remaining = (articles.length - processedCount) / rate;
      const progress = (processedCount / articles.length * 100).toFixed(1);
      process.stdout.write(`\r  Extracting: [${processedCount}/${articles.length}] ${progress}% - ETA: ${Math.round(remaining)}s`);
    }, 500);
    
    for (const article of articles) {
      const processPromise = this.concurrencyLimit(async () => {
        try {
          // 1. Temporal Analysis
          const temporalData = await this.temporalAnalyzer.analyze(article);
          
          // 2. Conflict Classification
          const hasConflict = await this.classifyConflict(article);
          
          if (!hasConflict) {
            return; // Skip non-conflict articles
          }
          
          // 3. Named Entity Recognition
          const entities = await this.ner.extractEntities(
            article.title + ' ' + article.snippet,
            { location: article.searchQuery?.subject, date: temporalData.timestamp }
          );
          
          // 4. Attribution Analysis
          const attribution = await this.analyzeAttribution(article);
          
          // 5. Sentiment/Opinion Detection
          const sentimentData = await this.analyzeSentiment(article);
          
          // 6. Fact Extraction
          const facts = await this.extractFacts(article);
          
          // 7. Media Bias Analysis
          const biasAnalysis = await this.mediaBiasAnalyzer.analyzeArticleBias(article, this.verbose);
          
          // 8. Media Analysis (images, videos, etc.)
          let mediaAnalysis = null;
          if (this.mediaAnalysisEnabled && article.images && article.images.length > 0) {
            try {
              mediaAnalysis = await this.analyzeArticleMedia(article);
            } catch (error) {
              if (this.verbose) {
                console.error(`Media analysis error: ${error.message}`);
              }
            }
          }
          
          // Store processed article
          const processedArticle = {
            ...article,
            temporal: temporalData,
            entities: entities,
            attribution: attribution,
            sentiment: sentimentData,
            facts: facts,
            biasAnalysis: biasAnalysis,
            mediaAnalysis: mediaAnalysis,
            isOpinion: sentimentData.subjectivity > 0.7,
            isAnalysis: sentimentData.analysisScore > 0.6,
            hasConflict: true
          };
          
          processedArticles.push(processedArticle);
          
          // Update stats
          this.enhancedStats.entitiesExtracted += entities.length;
          this.enhancedStats.factsExtracted += facts.length;
          
          // Store in database if not dry run
          if (!this.dryRun && this.supabase) {
            await this.storeProcessedArticle(processedArticle);
          }
          
          processedCount++;
          
        } catch (error) {
          console.error(`\nProcessing error for article:`, error.message);
          processedCount++;
        }
      });
      
      processingPromises.push(processPromise);
    }
    
    await Promise.all(processingPromises);
    
    clearInterval(progressInterval);
    console.log(`\r  Extracting: [${articles.length}/${articles.length}] 100% - Complete!                    `);
    console.log(`- Extracted ${this.enhancedStats.entitiesExtracted} named entities`);
    console.log(`- Identified ${this.enhancedStats.factsExtracted} fact claims`);
    console.log(`- Filtered to ${processedArticles.length} conflict-related articles`);
    
    return processedArticles;
  }
  
  /**
   * Phase 3: Event Processing
   */
  async eventProcessing(articles) {
    console.log(`- Extracting events from ${articles.length} processed articles`);
    
    // Extract events using parallel processing
    const events = [];
    const eventPromises = [];
    const startTime = Date.now();
    let processed = 0;
    
    // Progress tracking
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (articles.length - processed) / rate;
      process.stdout.write(`\r  [${processed}/${articles.length}] Processing... ETA: ${Math.round(remaining)}s`);
    }, 1000);
    
    // Process in parallel with concurrency limit
    for (const article of articles) {
      const eventPromise = this.concurrencyLimit(async () => {
        try {
          const analysisResult = await this.eventExtractor.analyzeArticle(article);
          
          if (analysisResult.isConflictRelated && analysisResult.events.length > 0) {
            const extractedEvents = analysisResult.events;
            
            // Enhance events with article metadata
            extractedEvents.forEach(event => {
              event.entities = article.entities;
              event.temporal = article.temporal;
              event.sourceArticle = article;
              events.push(event);
            });
          }
          
          processed++;
        } catch (error) {
          console.error(`\nEvent extraction error:`, error.message);
          processed++;
        }
      });
      
      eventPromises.push(eventPromise);
    }
    
    await Promise.all(eventPromises);
    clearInterval(progressInterval);
    console.log(`\r  [${processed}/${articles.length}] Event extraction complete!                    `);
    
    this.enhancedStats.eventsIdentified = events.length;
    console.log(`- Identified ${events.length} unique conflict events`);
    
    // Cluster events
    const clusters = await this.enhancedEventClustering(events);
    this.enhancedStats.eventClusters = clusters.length;
    console.log(`- Clustered into ${clusters.length} distinct event groups`);
    
    // Generate targeted searches for each cluster
    console.log(`- Generating targeted searches for event validation`);
    const eventGroups = await this.targetedResearch(clusters);
    
    return eventGroups;
  }
  
  /**
   * Enhanced event clustering with better similarity metrics
   */
  async enhancedEventClustering(events) {
    const clusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < events.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster = {
        primaryEvent: events[i],
        relatedEvents: [],
        articles: [events[i].sourceArticle],
        entities: new Set(events[i].entities.map(e => e.normalized)),
        confidence: 1.0,
        sourceCount: 1,
        sourceDiversity: 1.0
      };
      
      assigned.add(i);
      
      // Find related events with enhanced similarity
      for (let j = i + 1; j < events.length; j++) {
        if (assigned.has(j)) continue;
        
        const similarity = this.calculateEnhancedSimilarity(events[i], events[j]);
        
        if (similarity > 0.75) {
          cluster.relatedEvents.push(events[j]);
          cluster.articles.push(events[j].sourceArticle);
          cluster.sourceCount++;
          
          // Add entities to cluster
          events[j].entities.forEach(e => cluster.entities.add(e.normalized));
          
          assigned.add(j);
          
          // Merge event data
          events[i].mergeWith(events[j]);
        }
      }
      
      // Calculate source diversity
      const uniqueSources = new Set(cluster.articles.map(a => a.source));
      cluster.sourceDiversity = uniqueSources.size / cluster.articles.length;
      
      // Update confidence based on corroboration
      cluster.confidence = Math.min(1.0, 0.5 + (cluster.sourceCount * 0.1) + (cluster.sourceDiversity * 0.2));
      
      clusters.push(cluster);
    }
    
    return clusters;
  }
  
  /**
   * Calculate enhanced similarity between events
   */
  calculateEnhancedSimilarity(event1, event2) {
    let score = 0;
    let weights = 0;
    
    // Temporal similarity (weight: 0.25)
    if (event1.temporal && event2.temporal) {
      const timeDiff = Math.abs(event1.temporal.timestamp - event2.temporal.timestamp) / (1000 * 60 * 60);
      const temporalScore = Math.max(0, 1 - (timeDiff / 48)); // 48-hour window
      score += temporalScore * 0.25;
      weights += 0.25;
    }
    
    // Location similarity (weight: 0.3)
    const locationScore = this.calculateLocationSimilarity(event1, event2);
    score += locationScore * 0.3;
    weights += 0.3;
    
    // Entity overlap (weight: 0.3)
    const entityScore = this.calculateEntityOverlap(event1.entities, event2.entities);
    score += entityScore * 0.3;
    weights += 0.3;
    
    // Event type similarity (weight: 0.15)
    if (event1.eventType === event2.eventType) {
      score += 0.15;
      weights += 0.15;
    }
    
    return weights > 0 ? score / weights : 0;
  }
  
  /**
   * Targeted research for event groups
   */
  async targetedResearch(clusters) {
    const eventGroups = [];
    const allQueries = new Map(); // For deduplication
    
    // First pass: collect and deduplicate all queries
    console.log(`- Generating queries for ${clusters.length} event clusters`);
    for (const cluster of clusters) {
      const targetedQueries = this.queryGenerator.generateTargetedQueries(cluster.primaryEvent);
      
      targetedQueries.forEach(query => {
        const queryKey = query.query.toLowerCase().trim();
        if (!allQueries.has(queryKey)) {
          allQueries.set(queryKey, {
            query: query,
            clusters: [cluster]
          });
        } else {
          allQueries.get(queryKey).clusters.push(cluster);
        }
      });
    }
    
    console.log(`- Deduplicated to ${allQueries.size} unique queries`);
    this.enhancedStats.targetedSearches = allQueries.size;
    
    // Execute searches with progress tracking
    let searchCount = 0;
    const searchResults = new Map();
    const startTime = Date.now();
    
    // Process queries in parallel batches
    const queryArray = Array.from(allQueries.entries());
    const batchSize = 5;
    
    for (let i = 0; i < queryArray.length; i += batchSize) {
      const batch = queryArray.slice(i, Math.min(i + batchSize, queryArray.length));
      
      const batchPromises = batch.map(async ([queryKey, queryData]) => {
        try {
          const results = await this.searchArticles(queryData.query.query);
          searchResults.set(queryKey, results);
          searchCount++;
          
          // Show progress
          const progress = (searchCount / allQueries.size * 100).toFixed(1);
          process.stdout.write(`\r  Targeted searches: [${searchCount}/${allQueries.size}] ${progress}% complete`);
        } catch (error) {
          console.error(`\n  Search error for "${queryData.query.query}":`, error.message);
          searchResults.set(queryKey, []);
          searchCount++;
        }
      });
      
      await Promise.all(batchPromises);
    }
    
    console.log('\r  Targeted searches: Complete!                                              ');
    
    // Process results and assign to clusters
    console.log(`- Processing search results for event validation`);
    let processedCount = 0;
    const totalArticles = Array.from(searchResults.values()).reduce((sum, results) => sum + results.length, 0);
    
    for (const cluster of clusters) {
      const additionalArticles = [];
      const relevantQueries = this.queryGenerator.generateTargetedQueries(cluster.primaryEvent);
      
      for (const query of relevantQueries) {
        const queryKey = query.query.toLowerCase().trim();
        const results = searchResults.get(queryKey) || [];
        
        // Skip processing if no results
        if (results.length === 0) continue;
        
        // For targeted searches, use simplified processing
        for (const article of results) {
          // Simple conflict check based on keywords instead of API call
          const conflictKeywords = ['conflict', 'attack', 'military', 'casualties', 'combat', 'forces', 'operation'];
          const hasConflictKeywords = conflictKeywords.some(keyword => 
            (article.title + ' ' + article.snippet).toLowerCase().includes(keyword)
          );
          
          if (hasConflictKeywords) {
            // Extract basic facts without API calls
            const simpleFacts = await this.extractFacts(article);
            
            additionalArticles.push({
              ...article,
              searchQuery: query,
              entities: [], // Skip entity extraction for targeted searches
              isOpinion: false,
              facts: simpleFacts
            });
          }
          
          processedCount++;
          if (processedCount % 10 === 0) {
            process.stdout.write(`\r  Processing results: [${processedCount}/${totalArticles}] ${(processedCount/totalArticles*100).toFixed(1)}%`);
          }
        }
      }
      
      // Create comprehensive event group
      const eventGroup = {
        ...cluster,
        additionalArticles: additionalArticles,
        totalArticles: cluster.articles.length + additionalArticles.length,
        targetedSearchCount: relevantQueries.length
      };
      
      eventGroups.push(eventGroup);
    }
    
    if (processedCount > 0) {
      console.log(`\r  Processing results: Complete!                                          `);
    }
    console.log(`- Executed ${this.enhancedStats.targetedSearches} targeted searches`);
    console.log(`- Compiled ${eventGroups.length} comprehensive event groups`);
    
    return eventGroups;
  }
  
  /**
   * Analyze media content in articles
   */
  async analyzeArticleMedia(article) {
    const mediaResults = {
      images: [],
      totalImages: 0,
      hasGeolocation: false,
      anomaliesDetected: [],
      steganographyRisk: 'low'
    };

    if (!article.images || article.images.length === 0) {
      return mediaResults;
    }

    mediaResults.totalImages = article.images.length;

    // Analyze up to 3 images per article to avoid overload
    const imagesToAnalyze = article.images.slice(0, 3);

    for (const imageUrl of imagesToAnalyze) {
      try {
        // Download image temporarily
        const imagePath = await this.downloadImage(imageUrl);
        
        if (imagePath) {
          // Run metadata extraction
          const analysisResult = await this.mediaAnalyzer.analyzeMedia(imagePath, {
            checkSteganography: false // Disable by default for performance
          });

          // Process results
          const imageResult = {
            url: imageUrl,
            metadata: analysisResult.metadata,
            geolocation: analysisResult.geolocation,
            anomalies: analysisResult.anomalies
          };

          // Check for geolocation
          if (analysisResult.geolocation) {
            mediaResults.hasGeolocation = true;
          }

          // Add anomalies
          if (analysisResult.anomalies && analysisResult.anomalies.length > 0) {
            mediaResults.anomaliesDetected.push(...analysisResult.anomalies);
          }

          mediaResults.images.push(imageResult);

          // Clean up temporary file
          await this.cleanupTempFile(imagePath);
        }
      } catch (error) {
        if (this.verbose) {
          console.error(`Failed to analyze image ${imageUrl}:`, error.message);
        }
      }
    }

    // Update steganography risk based on anomalies
    if (mediaResults.anomaliesDetected.some(a => a.type === 'steganography')) {
      mediaResults.steganographyRisk = 'high';
    } else if (mediaResults.anomaliesDetected.length > 0) {
      mediaResults.steganographyRisk = 'medium';
    }

    return mediaResults;
  }

  /**
   * Download image for analysis
   */
  async downloadImage(url) {
    try {
      const response = await fetch(url, { timeout: 10000 });
      if (!response.ok) return null;

      const buffer = await response.buffer();
      const tempPath = path.join(this.cacheDir, `temp_${Date.now()}_${path.basename(url)}`);
      
      await fs.writeFile(tempPath, buffer);
      return tempPath;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up temporary file
   */
  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Phase 4: Validation & Analysis
   */
  async validationAnalysis(eventGroups) {
    console.log(`- Validating ${eventGroups.length} event groups`);
    
    const validatedEvents = [];
    
    for (const group of eventGroups) {
      // Separate facts from opinions
      const allArticles = [...group.articles, ...group.additionalArticles];
      const factualArticles = allArticles.filter(a => !a.isOpinion);
      const opinionArticles = allArticles.filter(a => a.isOpinion);
      
      // Extract all fact claims
      const allFacts = [];
      factualArticles.forEach(article => {
        article.facts?.forEach(fact => {
          allFacts.push({
            ...fact,
            sourceArticle: article
          });
        });
      });
      
      // Cross-source fact comparison
      const validatedFacts = await this.factValidator.validateFacts(allFacts);
      
      // Calculate reliability scores
      const reliabilityScore = this.calculateGroupReliability(group, validatedFacts);
      
      // Analyze bias distribution
      const biasDistribution = this.analyzeGroupBias(allArticles);
      
      // Create validated event
      const validatedEvent = {
        ...group,
        factualArticles: factualArticles.length,
        opinionArticles: opinionArticles.length,
        validatedFacts: validatedFacts.corroborated,
        disputedFacts: validatedFacts.disputed,
        reliabilityScore: reliabilityScore,
        biasAnalysis: await this.analyzeBias(allArticles),
        biasDistribution: biasDistribution
      };
      
      validatedEvents.push(validatedEvent);
      
      // Update stats
      this.enhancedStats.corroboratedFacts += validatedFacts.corroborated.length;
      this.enhancedStats.disputedClaims += validatedFacts.disputed.length;
    }
    
    console.log(`- Corroborated ${this.enhancedStats.corroboratedFacts} facts`);
    console.log(`- Identified ${this.enhancedStats.disputedClaims} disputed claims`);
    
    return validatedEvents;
  }
  
  /**
   * Phase 5: Output Generation
   */
  async outputGeneration(validatedEvents) {
    console.log(`- Generating output for ${validatedEvents.length} validated events`);
    
    // Generate enhanced headlines
    for (const event of validatedEvents) {
      event.synthesizedHeadline = await this.generateSynthesizedHeadline(event);
    }
    
    // Store events in database
    if (!this.dryRun && this.supabase) {
      await this.storeValidatedEvents(validatedEvents);
    }
    
    // Generate critical alerts
    const criticalEvents = validatedEvents.filter(e => 
      e.primaryEvent.severity === 'critical' ||
      e.primaryEvent.escalationScore >= 7 ||
      e.reliabilityScore > 0.8
    );
    
    this.enhancedStats.criticalAlerts = criticalEvents.length;
    
    // Display alerts
    console.log(`\n🚨 Generated ${criticalEvents.length} critical alerts:\n`);
    
    criticalEvents.forEach(event => {
      console.log(`📍 ${event.synthesizedHeadline}`);
      console.log(`   Location: ${event.primaryEvent.locationName}`);
      console.log(`   Reliability: ${(event.reliabilityScore * 100).toFixed(0)}%`);
      console.log(`   Sources: ${event.totalArticles} articles (${event.factualArticles} factual)`);
      
      // Show bias distribution
      if (event.biasDistribution) {
        const biasStr = Object.entries(event.biasDistribution.distribution)
          .filter(([_, count]) => count > 0)
          .map(([bias, count]) => `${bias}: ${count}`)
          .join(', ');
        console.log(`   Bias Distribution: ${biasStr}`);
        console.log(`   Average Bias: ${event.biasDistribution.averageScore.toFixed(2)} (${event.biasDistribution.dominantBias})`);
      }
      
      if (event.primaryEvent.casualties?.killed) {
        console.log(`   Casualties: ${event.primaryEvent.casualties.killed} killed`);
      }
      console.log('');
    });
  }
  
  /**
   * Helper methods
   */
  
  async classifyConflict(article) {
    // Use AI to classify if article contains conflict content
    const conflictKeywords = [
      'killed', 'attack', 'strike', 'conflict', 'war', 'battle',
      'casualties', 'military', 'explosion', 'violence', 'clashes'
    ];
    
    const text = (article.title + ' ' + article.snippet).toLowerCase();
    return conflictKeywords.some(keyword => text.includes(keyword));
  }
  
  async analyzeAttribution(article) {
    // Extract source attribution
    return {
      source: article.source,
      author: article.author || 'Unknown',
      publishDate: article.publishedDate,
      url: article.url
    };
  }
  
  async analyzeSentiment(article) {
    // Simplified sentiment analysis
    const text = article.title + ' ' + article.snippet;
    
    // Check for opinion indicators
    const opinionIndicators = [
      'believes', 'thinks', 'argues', 'claims', 'alleges',
      'editorial', 'opinion', 'analysis', 'commentary'
    ];
    
    const hasOpinionIndicators = opinionIndicators.some(indicator => 
      text.toLowerCase().includes(indicator)
    );
    
    return {
      subjectivity: hasOpinionIndicators ? 0.8 : 0.3,
      analysisScore: text.includes('analysis') ? 0.7 : 0.3,
      sentiment: 0 // Neutral
    };
  }
  
  async extractFacts(article) {
    // Extract factual claims from article
    const facts = [];
    const text = (article.title + ' ' + article.snippet + ' ' + (article.content || '')).toLowerCase();
    
    // 1. Casualty claims
    const casualtyPattern = /(\d+)\s*(?:people\s+)?(?:were\s+)?(killed|dead|died|casualties|wounded|injured|hurt)/gi;
    const casualtyMatches = text.matchAll(casualtyPattern);
    for (const match of casualtyMatches) {
      facts.push({
        type: 'casualty',
        claim: match[0].trim(),
        value: parseInt(match[1]),
        confidence: 0.8
      });
    }
    
    // 2. Military equipment/weapons
    const equipmentPattern = /(\d+)\s*(tanks?|missiles?|rockets?|drones?|aircraft|helicopters?|vehicles?|weapons?)/gi;
    const equipmentMatches = text.matchAll(equipmentPattern);
    for (const match of equipmentMatches) {
      facts.push({
        type: 'equipment',
        claim: match[0].trim(),
        value: parseInt(match[1]),
        equipment: match[2],
        confidence: 0.7
      });
    }
    
    // 3. Geographic/location facts
    const locationPattern = /(attacked|captured|seized|lost|gained control of|withdrew from|advanced to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    const locationMatches = text.matchAll(locationPattern);
    for (const match of locationMatches) {
      facts.push({
        type: 'location',
        claim: match[0].trim(),
        action: match[1],
        location: match[2],
        confidence: 0.6
      });
    }
    
    // 4. Force size claims
    const forcePattern = /(\d+(?:,\d{3})*)\s*(troops?|soldiers?|fighters?|forces|personnel)/gi;
    const forceMatches = text.matchAll(forcePattern);
    for (const match of forceMatches) {
      const value = parseInt(match[1].replace(/,/g, ''));
      if (value > 0 && value < 1000000) { // Sanity check
        facts.push({
          type: 'force_size',
          claim: match[0].trim(),
          value: value,
          unit: match[2],
          confidence: 0.7
        });
      }
    }
    
    // 5. Temporal facts (specific dates mentioned)
    const datePattern = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?/gi;
    const dateMatches = text.matchAll(datePattern);
    for (const match of dateMatches) {
      facts.push({
        type: 'temporal',
        claim: match[0].trim(),
        month: match[1],
        day: match[2],
        year: match[3] || new Date().getFullYear(),
        confidence: 0.8
      });
    }
    
    // 6. Financial/economic facts
    const financialPattern = /\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)(\s*(?:million|billion|trillion))?/gi;
    const financialMatches = text.matchAll(financialPattern);
    for (const match of financialMatches) {
      facts.push({
        type: 'financial',
        claim: match[0].trim(),
        value: match[1],
        scale: match[2]?.trim() || 'dollars',
        confidence: 0.7
      });
    }
    
    // 7. Percentage claims
    const percentPattern = /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?([a-z\s]+)/gi;
    const percentMatches = text.matchAll(percentPattern);
    for (const match of percentMatches) {
      const context = match[2].trim().slice(0, 50); // Limit context length
      if (context.length > 3) { // Skip empty contexts
        facts.push({
          type: 'percentage',
          claim: match[0].trim(),
          value: parseFloat(match[1]),
          context: context,
          confidence: 0.6
        });
      }
    }
    
    return facts;
  }
  
  calculateLocationSimilarity(event1, event2) {
    if (!event1.locationName || !event2.locationName) return 0;
    
    // Simple string similarity
    const loc1 = event1.locationName.toLowerCase();
    const loc2 = event2.locationName.toLowerCase();
    
    if (loc1 === loc2) return 1;
    if (loc1.includes(loc2) || loc2.includes(loc1)) return 0.8;
    
    // Check country match
    if (event1.country === event2.country) return 0.5;
    
    return 0;
  }
  
  calculateEntityOverlap(entities1, entities2) {
    if (!entities1?.length || !entities2?.length) return 0;
    
    const set1 = new Set(entities1.map(e => e.normalized));
    const set2 = new Set(entities2.map(e => e.normalized));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  calculateGroupReliability(group, validatedFacts) {
    const factors = {
      sourceCount: Math.min(group.sourceCount / 5, 1) * 0.2,
      sourceDiversity: group.sourceDiversity * 0.3,
      factCorroboration: (validatedFacts.corroborated.length / 
        (validatedFacts.corroborated.length + validatedFacts.disputed.length || 1)) * 0.3,
      temporalConsistency: group.primaryEvent.temporal?.confidence || 0.5 * 0.2
    };
    
    return Object.values(factors).reduce((sum, val) => sum + val, 0);
  }
  
  async analyzeBias(articles) {
    const sources = articles.map(a => a.source);
    const uniqueSources = [...new Set(sources)];
    
    // Simple bias distribution
    return {
      sourceCount: uniqueSources.length,
      sourceDiversity: uniqueSources.length / articles.length,
      primarySource: sources[0]
    };
  }
  
  /**
   * Analyze bias distribution for a group of articles
   */
  analyzeGroupBias(articles) {
    const biasScores = {
      'far-left': 0,
      'left': 0,
      'center': 0,
      'right': 0,
      'far-right': 0
    };
    
    let totalScore = 0;
    let count = 0;
    
    for (const article of articles) {
      if (article.biasAnalysis?.biasAnalysis) {
        const label = article.biasAnalysis.biasAnalysis.label;
        const score = article.biasAnalysis.biasAnalysis.score;
        
        biasScores[label] = (biasScores[label] || 0) + 1;
        totalScore += score;
        count++;
      }
    }
    
    return {
      distribution: biasScores,
      averageScore: count > 0 ? totalScore / count : 0,
      dominantBias: Object.entries(biasScores).sort((a, b) => b[1] - a[1])[0][0]
    };
  }
  
  async generateSynthesizedHeadline(event) {
    // Use primary event headline with enhancements
    const facts = event.validatedFacts?.length > 0 ? ' (Confirmed)' : '';
    const sources = ` - ${event.totalArticles} sources`;
    
    return event.primaryEvent.enhancedHeadline + facts + sources;
  }
  
  /**
   * Report enhanced results
   */
  reportEnhancedResults(processedArticles) {
    console.log('\n📊 Enhanced Ingestion Results:');
    console.log('━'.repeat(50));
    console.log(`Total Queries Generated: ${this.enhancedStats.totalQueries}`);
    console.log(`Raw Articles Collected: ${this.enhancedStats.rawArticles}`);
    console.log(`Unique Articles: ${this.enhancedStats.uniqueArticles}`);
    console.log(`Entities Extracted: ${this.enhancedStats.entitiesExtracted}`);
    console.log(`Facts Extracted: ${this.enhancedStats.factsExtracted}`);
    console.log(`Events Identified: ${this.enhancedStats.eventsIdentified}`);
    console.log(`Event Clusters: ${this.enhancedStats.eventClusters}`);
    console.log(`Targeted Searches: ${this.enhancedStats.targetedSearches}`);
    console.log(`Corroborated Facts: ${this.enhancedStats.corroboratedFacts}`);
    console.log(`Disputed Claims: ${this.enhancedStats.disputedClaims}`);
    console.log(`Critical Alerts: ${this.enhancedStats.criticalAlerts}`);
    console.log('━'.repeat(50));
    
    // Add media bias summary
    if (processedArticles && processedArticles.length > 0) {
      this.reportMediaBiasSummary(processedArticles);
    }
    
    // Calculate ratios
    const deduplicationEfficiency = ((this.enhancedStats.rawArticles - this.enhancedStats.uniqueArticles) / 
      this.enhancedStats.rawArticles * 100).toFixed(1);
    const articleToEventRatio = (this.enhancedStats.uniqueArticles / 
      this.enhancedStats.eventsIdentified).toFixed(1);
    const totalFacts = this.enhancedStats.corroboratedFacts + this.enhancedStats.disputedClaims;
    const factCorroborationRate = totalFacts > 0 
      ? (this.enhancedStats.corroboratedFacts / totalFacts * 100).toFixed(1)
      : 'N/A';
    
    console.log('\n📈 Key Metrics:');
    console.log(`Deduplication Efficiency: ${deduplicationEfficiency}%`);
    console.log(`Article-to-Event Ratio: ${articleToEventRatio}:1`);
    console.log(`Fact Corroboration Rate: ${factCorroborationRate}%`);
  }
  
  /**
   * Report media bias summary
   */
  reportMediaBiasSummary(articles) {
    console.log('\n📰 Media Bias Analysis Summary:');
    console.log('━'.repeat(50));
    
    const biasDistribution = {
      'far-left': 0,
      'left': 0,
      'center': 0,
      'right': 0,
      'far-right': 0,
      'unknown': 0
    };
    
    const sourcesBias = new Map();
    let totalBiasScore = 0;
    let analyzedCount = 0;
    
    for (const article of articles) {
      if (article.biasAnalysis?.biasAnalysis) {
        const bias = article.biasAnalysis.biasAnalysis;
        biasDistribution[bias.label] = (biasDistribution[bias.label] || 0) + 1;
        totalBiasScore += bias.score;
        analyzedCount++;
        
        // Track bias by source
        const source = article.source;
        if (!sourcesBias.has(source)) {
          sourcesBias.set(source, { total: 0, count: 0, articles: [] });
        }
        const sourceBias = sourcesBias.get(source);
        sourceBias.total += bias.score;
        sourceBias.count++;
        sourceBias.articles.push(bias.label);
      }
    }
    
    // Display bias distribution
    console.log('Overall Bias Distribution:');
    for (const [label, count] of Object.entries(biasDistribution)) {
      if (count > 0) {
        const percentage = (count / articles.length * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count / articles.length * 20));
        console.log(`  ${label.padEnd(10)} ${count.toString().padStart(3)} (${percentage.padStart(5)}%) ${bar}`);
      }
    }
    
    console.log(`\nAverage Bias Score: ${(totalBiasScore / analyzedCount).toFixed(2)} (${this.mediaBiasAnalyzer.getLabel(totalBiasScore / analyzedCount)})`);
    
    // Display top biased sources
    console.log('\nBias by News Source:');
    const sortedSources = Array.from(sourcesBias.entries())
      .map(([source, data]) => ({
        source,
        avgBias: data.total / data.count,
        count: data.count
      }))
      .sort((a, b) => Math.abs(b.avgBias) - Math.abs(a.avgBias))
      .slice(0, 5);
    
    for (const source of sortedSources) {
      const label = this.mediaBiasAnalyzer.getLabel(source.avgBias);
      console.log(`  ${source.source.padEnd(30)} ${source.avgBias.toFixed(2).padStart(6)} (${label}) - ${source.count} articles`);
    }
    
    console.log('━'.repeat(50));
  }
  
  /**
   * Quick article processing for targeted searches
   */
  async quickProcessArticle(article) {
    try {
      const hasConflict = await this.classifyConflict(article);
      if (!hasConflict) return null;
      
      const entities = await this.ner.extractEntities(
        article.title + ' ' + article.snippet
      );
      
      return {
        ...article,
        entities: entities,
        isOpinion: false, // Simplified for targeted searches
        facts: await this.extractFacts(article)
      };
    } catch (error) {
      console.error('Quick process error:', error.message);
      return null;
    }
  }
  
  /**
   * Enhanced deduplication
   */
  enhancedDeduplication(articles) {
    const seen = new Map();
    const unique = [];
    
    for (const article of articles) {
      // Create multiple deduplication keys
      const urlKey = article.url;
      const contentKey = this.textProcessor.generateContentHash(
        article.title + article.snippet
      );
      const titleKey = this.textProcessor.generateContentHash(article.title);
      
      // Check all keys
      if (!seen.has(urlKey) && !seen.has(contentKey) && !seen.has(titleKey)) {
        seen.set(urlKey, true);
        seen.set(contentKey, true);
        seen.set(titleKey, true);
        unique.push(article);
      }
    }
    
    return unique;
  }
  
  /**
   * Store processed article with all extracted data
   */
  async storeProcessedArticle(article) {
    try {
      // Store article
      const { data: storedArticle } = await this.supabase
        .from('articles')
        .insert({
          title: article.title,
          url: article.url,
          snippet: article.snippet,
          source: article.source,
          published_date: article.publishedDate,
          temporal_precision: article.temporal?.precision,
          temporal_confidence: article.temporal?.confidence,
          is_opinion: article.isOpinion,
          is_analysis: article.isAnalysis,
          extracted_claims: article.facts,
          search_query: article.searchQuery?.query
        })
        .select()
        .single();
      
      if (storedArticle && article.entities.length > 0) {
        // Link entities
        const linkedEntities = await this.ner.linkEntities(
          article.entities,
          this.supabase
        );
        
        // Update article with entity IDs
        await this.supabase
          .from('articles')
          .update({
            extracted_entities: linkedEntities.map(e => e.entity_id)
          })
          .eq('id', storedArticle.id);
      }
      
      return storedArticle;
    } catch (error) {
      console.error('Store article error:', error);
      return null;
    }
  }
  
  /**
   * Store validated events with full metadata
   */
  async storeValidatedEvents(events) {
    for (const eventGroup of events) {
      try {
        // Store primary event
        const { data: storedEvent } = await this.supabase
          .from('events')
          .insert(eventGroup.primaryEvent.toDatabaseFormat())
          .select()
          .single();
        
        if (storedEvent) {
          // Create event group with enhanced metadata
          await this.supabase
            .from('event_groups')
            .insert({
              event_ids: [storedEvent.id],
              primary_event_id: storedEvent.id,
              group_confidence: eventGroup.confidence,
              corroboration_count: eventGroup.sourceCount,
              source_diversity_score: eventGroup.sourceDiversity,
              average_reliability: eventGroup.reliabilityScore,
              generated_headline: eventGroup.synthesizedHeadline,
              total_articles: eventGroup.totalArticles,
              factual_articles: eventGroup.factualArticles,
              opinion_articles: eventGroup.opinionArticles,
              cross_corroboration_score: eventGroup.reliabilityScore
            });
          
          // Link articles to event
          for (const article of [...eventGroup.articles, ...eventGroup.additionalArticles]) {
            if (article.id) {
              await this.supabase
                .from('event_articles')
                .insert({
                  event_id: storedEvent.id,
                  article_id: article.id,
                  relevance_score: 0.8,
                  is_primary_source: eventGroup.articles.includes(article)
                });
            }
          }
        }
      } catch (error) {
        console.error('Store event error:', error);
      }
    }
  }

  /**
   * Override parent's clusterEvents with enhanced vector-based clustering
   */
  async clusterEvents(events) {
    if (events.length === 0) return [];
    
    console.log(`\nPerforming enhanced vector-based event clustering on ${events.length} events...`);
    
    const clusters = [];
    const assigned = new Set();
    
    for (let i = 0; i < events.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster = {
        primaryEvent: events[i],
        relatedEvents: [],
        confidence: 1.0,
        sourceCount: 1,
        similarityScores: []
      };
      
      assigned.add(i);
      
      // Find similar events using hybrid similarity
      for (let j = i + 1; j < events.length; j++) {
        if (assigned.has(j)) continue;
        
        // Calculate hybrid similarity
        const similarityData = await this.similarityService.calculateHybridSimilarity(
          events[i], 
          events[j]
        );
        
        // Use HDBSCAN-like approach: cluster if vector similarity is high
        if (similarityData.vectorSimilarity > 0.7 || similarityData.hybridScore > 0.75) {
          cluster.relatedEvents.push(events[j]);
          cluster.sourceCount++;
          cluster.similarityScores.push(similarityData);
          assigned.add(j);
          
          // Merge events
          events[i].mergeWith(events[j]);
          
          if (this.verbose) {
            console.log(`  Clustered events with hybrid score: ${similarityData.hybridScore.toFixed(3)}`);
            console.log(`    Vector: ${similarityData.vectorSimilarity.toFixed(3)}, ` +
                       `Temporal: ${similarityData.temporalSimilarity.toFixed(3)}, ` +
                       `Geographic: ${similarityData.geographicSimilarity.toFixed(3)}, ` +
                       `Actor: ${similarityData.actorOverlap.toFixed(3)}`);
          }
        }
      }
      
      // Update cluster confidence based on corroboration and similarity
      const avgSimilarity = cluster.similarityScores.length > 0
        ? cluster.similarityScores.reduce((sum, s) => sum + s.hybridScore, 0) / cluster.similarityScores.length
        : 1.0;
      
      cluster.confidence = Math.min(1.0, 0.5 + (cluster.sourceCount * 0.1) + (avgSimilarity * 0.2));
      cluster.primaryEvent.reliability = cluster.confidence;
      
      clusters.push(cluster);
    }
    
    console.log(`Clustered ${events.length} events into ${clusters.length} groups`);
    
    // Log clustering statistics
    const singletonClusters = clusters.filter(c => c.relatedEvents.length === 0).length;
    const largeClusters = clusters.filter(c => c.relatedEvents.length >= 3).length;
    console.log(`  - Singleton clusters: ${singletonClusters}`);
    console.log(`  - Large clusters (3+ events): ${largeClusters}`);
    
    this.enhancedStats.eventClusters = clusters.length;
    
    return clusters;
  }
}