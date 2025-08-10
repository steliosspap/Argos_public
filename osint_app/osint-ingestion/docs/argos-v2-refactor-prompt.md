# 🎯 Argos Pipeline V2 - Complete Architecture Refactor

You are tasked with completely refactoring the Argos conflict intelligence pipeline to fix fundamental architectural issues and implement a production-ready system.

## 🔴 CRITICAL CHANGES REQUIRED

### 1. DATA ARCHITECTURE OVERHAUL
**Current Problem**: Pipeline assumes 1 article = 1 event (WRONG)
**Required Fix**: Implement proper many-to-many relationships:
- 1 Article → Multiple Events
- 1 Event → 1 Article (source)
- Events → Many Named Entities
- Articles → 1 Media Organization + 1-N Authors

### 2. DYNAMIC SEARCH STRATEGY
**Current Problem**: Static subjects, no learning from discovered events
**Required Fix**: 
- Maintain dynamic conflict subjects list (grows from extracted events)
- LLM-generated targeted queries after each extraction
- Continuous re-ingestion loop

### 3. MULTI-EVENT EXTRACTION
**Current Problem**: Extracts only one event per article
**Required Fix**: Extract ALL conflict events from each article with full metadata

## 📋 IMPLEMENTATION REQUIREMENTS

### DATABASE SCHEMA (Supabase-Ready)

```typescript
// articles_raw
interface ArticleRaw {
  id: string; // UUID
  url: string; // canonical URL
  headline: string;
  content: string;
  published_date: string; // ISO 8601
  first_detected: string; // when we found it
  last_modified: string; // if article updated
  source_id: string; // FK to sources
  author_ids: string[]; // FK to authors
  search_round: number;
  search_query: string;
  content_hash: string; // SHA-256 for dedup
  created_at: string;
  updated_at: string;
}

// events
interface Event {
  id: string; // UUID
  article_id: string; // FK to articles_raw
  actor: string; // "Russian forces", "IDF", etc.
  target: string; // "power infrastructure", "military base"
  location: string; // validated geographic location
  action: string; // "launched airstrikes", "seized control"
  estimated_date: string; // ISO 8601
  temporal_expression: string; // "yesterday", "last night"
  confidence_interval: string; // "±4 hours", "same day"
  binary_flags: {
    is_airstrike: boolean;
    is_ground_operation: boolean;
    is_naval_incident: boolean;
    is_cyber_attack: boolean;
    is_artillery: boolean;
    is_drone_strike: boolean;
    has_civilian_casualties: boolean;
    is_ceasefire: boolean;
    is_negotiation: boolean;
  };
  event_category: string; // "kinetic", "diplomatic", "humanitarian"
  event_subcategory: string; // "airstrike", "ground_assault", "naval_blockade"
  attribution_source: string; // "government", "NGO", "witness", "unattributed"
  attribution_text: string; // "according to Ukrainian officials"
  sentiment_score: number; // -1 to 1 via LLM
  summary: string; // LLM-generated one-liner
  raw_sentence: string; // original text that described this event
  extraction_confidence: number; // 0-1
  created_at: string;
}

// event_named_entities (junction table)
interface EventNamedEntity {
  event_id: string;
  named_entity_id: string;
  role: string; // "actor", "target", "location", "weapon", "mentioned"
  created_at: string;
}

// named_entities
interface NamedEntity {
  id: string; // UUID
  name: string; // "Vladimir Putin", "Shahed drone", "Khartoum"
  type: string; // "person", "organization", "location", "weapon", "military_unit"
  normalized_name: string; // standardized version
  aliases: string[]; // ["RSF", "Rapid Support Forces"]
  first_seen: string;
  last_seen: string;
  mention_count: number;
  source_article_ids: string[]; // denormalized for performance
  metadata: object; // type-specific data
  created_at: string;
  updated_at: string;
}

// sources (media organizations)
interface Source {
  id: string; // UUID
  name: string; // "Reuters"
  normalized_name: string; // "reuters"
  website: string;
  country_of_origin: string;
  bias_score: number; // -1 (left) to 1 (right)
  reliability_score: number; // 0-100
  bias_source: string; // "allsides", "mediabiasfactcheck", "manual"
  last_bias_update: string;
  metadata: object;
  created_at: string;
  updated_at: string;
}

// authors
interface Author {
  id: string; // UUID
  name: string;
  normalized_name: string;
  source_id: string; // primary affiliation
  article_count: number;
  inferred_bias_score: number; // calculated from articles
  bias_confidence: number; // 0-1
  first_seen: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

// event_groups (for corroboration)
interface EventGroup {
  id: string; // UUID
  event_ids: string[];
  primary_event_id: string; // most detailed/reliable
  group_confidence: number; // 0-1
  corroboration_count: number;
  source_diversity_score: number; // 0-1
  generated_headline: string;
  bias_distribution: object;
  average_reliability: number;
  created_at: string;
}

// search_queries (audit trail)
interface SearchQuery {
  id: string; // UUID
  query_text: string;
  query_type: string; // "broad", "targeted", "llm_generated"
  subject: string;
  modifier: string;
  round_number: number;
  articles_found: number;
  events_extracted: number;
  executed_at: string;
  created_at: string;
}
```

## 🔧 CORE MODULES TO IMPLEMENT

### 1. Enhanced Article Ingestion

```javascript
class ArticleIngestion {
  constructor(supabase) {
    this.supabase = supabase;
    this.sourceCache = new Map(); // cache source lookups
    this.authorCache = new Map();
  }

  async ingestArticle(rawArticle, searchQuery) {
    // 1. Deduplicate by URL and content hash
    const contentHash = this.generateHash(rawArticle.content);
    const existing = await this.findExistingArticle(rawArticle.url, contentHash);
    
    if (existing) {
      // Update last_modified if content changed
      if (existing.content_hash !== contentHash) {
        await this.updateArticle(existing.id, rawArticle);
      }
      return existing;
    }

    // 2. Extract and resolve source
    const source = await this.resolveSource(rawArticle.source_name);
    
    // 3. Extract and resolve authors
    const authors = await this.extractAuthors(rawArticle.content);
    
    // 4. Create article record
    const article = await this.createArticle({
      url: rawArticle.url,
      headline: this.extractHeadline(rawArticle),
      content: rawArticle.content,
      published_date: rawArticle.published_date,
      source_id: source.id,
      author_ids: authors.map(a => a.id),
      search_query: searchQuery,
      content_hash: contentHash
    });

    return article;
  }

  async resolveSource(sourceName) {
    // Check cache
    if (this.sourceCache.has(sourceName)) {
      return this.sourceCache.get(sourceName);
    }

    // Normalize and lookup
    const normalized = this.normalizeSourceName(sourceName);
    let source = await this.supabase
      .from('sources')
      .select('*')
      .eq('normalized_name', normalized)
      .single();

    if (!source) {
      // Create new source with default bias scores
      source = await this.createSource(sourceName);
    }

    this.sourceCache.set(sourceName, source);
    return source;
  }
}
```

### 2. Multi-Event Extraction Engine

```javascript
class MultiEventExtractor {
  constructor(supabase, llmClient) {
    this.supabase = supabase;
    this.llm = llmClient; // OpenAI or Claude
    this.nerRegistry = new NamedEntityRegistry(supabase);
  }

  async extractEventsFromArticle(article) {
    const events = [];
    
    // 1. Split article into sentences
    const sentences = this.intelligentSentenceSplit(article.content);
    
    // 2. Identify event-bearing sentences
    const eventSentences = await this.identifyEventSentences(sentences);
    
    // 3. Extract events from each sentence/paragraph
    for (const segment of eventSentences) {
      const extractedEvents = await this.extractEventsFromSegment(segment, article);
      events.push(...extractedEvents);
    }

    // 4. Merge duplicate events within same article
    const mergedEvents = this.mergeIntraArticleEvents(events);
    
    // 5. Extract and register all named entities
    for (const event of mergedEvents) {
      await this.extractAndLinkNamedEntities(event);
    }

    // 6. Generate LLM summaries and sentiment
    for (const event of mergedEvents) {
      event.summary = await this.generateEventSummary(event);
      event.sentiment_score = await this.analyzeSentiment(event);
    }

    return mergedEvents;
  }

  async extractEventsFromSegment(segment, article) {
    // Use regex patterns first
    const patterns = [
      {
        pattern: /([A-Z][\w\s]+(?:forces|military|army|troops))\s+(?:launched|conducted|carried out)\s+(?:an?\s+)?(\w+\s+)?(?:strikes?|attacks?|operations?)\s+(?:on|against|targeting)\s+([^,.]+?)(?:\s+in\s+([A-Z][\w\s]+?))?(?:[,.])/gi,
        extractor: (match) => ({
          actor: match[1].trim(),
          action: `${match[2] || ''}strike`.trim(),
          target: match[3].trim(),
          location: match[4]?.trim() || 'unknown'
        })
      },
      // Add more sophisticated patterns
    ];

    const events = [];
    
    // Pattern-based extraction
    for (const {pattern, extractor} of patterns) {
      const matches = [...segment.matchAll(pattern)];
      for (const match of matches) {
        const extracted = extractor(match);
        events.push(this.createEventObject(extracted, segment, article));
      }
    }

    // LLM-based extraction for complex cases
    if (events.length === 0 && this.hasConflictIndicators(segment)) {
      const llmEvents = await this.llmExtractEvents(segment);
      events.push(...llmEvents.map(e => this.createEventObject(e, segment, article)));
    }

    return events;
  }

  createEventObject(extracted, segment, article) {
    return {
      id: uuidv4(),
      article_id: article.id,
      actor: this.normalizeActor(extracted.actor),
      target: this.normalizeTarget(extracted.target),
      location: this.normalizeLocation(extracted.location),
      action: extracted.action,
      estimated_date: this.extractTemporalInfo(segment, article.published_date),
      temporal_expression: this.extractTemporalExpression(segment),
      confidence_interval: this.calculateConfidenceInterval(segment),
      binary_flags: this.extractBinaryFlags(segment),
      event_category: this.categorizeEvent(extracted),
      event_subcategory: this.subcategorizeEvent(extracted),
      attribution_source: this.extractAttribution(segment),
      attribution_text: this.extractAttributionText(segment),
      raw_sentence: segment,
      extraction_confidence: this.calculateExtractionConfidence(extracted)
    };
  }

  async llmExtractEvents(text) {
    const prompt = `Extract all distinct conflict events from this text. 
    For each event, identify:
    - actor (who did it)
    - action (what they did)
    - target (who/what was affected)
    - location (where it happened)
    
    Text: "${text}"
    
    Return as JSON array. If no clear events, return empty array.`;

    const response = await this.llm.complete(prompt);
    return JSON.parse(response);
  }
}
```

### 3. Named Entity Registry

```javascript
class NamedEntityRegistry {
  constructor(supabase) {
    this.supabase = supabase;
    this.cache = new Map();
  }

  async registerEntity(name, type, eventId, role) {
    const normalized = this.normalizeName(name, type);
    
    // Check cache and database
    let entity = await this.findEntity(normalized, type);
    
    if (!entity) {
      // Create new entity
      entity = await this.createEntity({
        name: name,
        normalized_name: normalized,
        type: type,
        aliases: this.generateAliases(name, type),
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        mention_count: 1
      });
    } else {
      // Update existing entity
      await this.updateEntityMention(entity.id);
    }

    // Link to event
    await this.linkEntityToEvent(entity.id, eventId, role);
    
    return entity;
  }

  normalizeName(name, type) {
    // Type-specific normalization
    switch(type) {
      case 'organization':
        return this.normalizeOrganization(name);
      case 'person':
        return this.normalizePerson(name);
      case 'location':
        return this.normalizeLocation(name);
      default:
        return name.toLowerCase().trim();
    }
  }

  normalizeOrganization(name) {
    // Handle acronyms and full names
    const acronymMap = {
      'IDF': 'Israel Defense Forces',
      'RSF': 'Rapid Support Forces',
      'NATO': 'North Atlantic Treaty Organization',
      // ... more mappings
    };

    const normalized = name.trim();
    return acronymMap[normalized] || normalized;
  }
}
```

### 4. Dynamic Search Generation

```javascript
class DynamicSearchEngine {
  constructor(supabase, llm) {
    this.supabase = supabase;
    this.llm = llm;
    this.activeSubjects = new Set(INITIAL_CONFLICT_SUBJECTS);
  }

  async generateSearchQueries(phase = 'broad') {
    const queries = [];
    
    if (phase === 'broad') {
      // Standard subject + modifier combinations
      const modifiers = ["today", "this morning", "update", "news", "breaking", "report"];
      
      for (const subject of this.activeSubjects) {
        for (const modifier of modifiers) {
          queries.push({
            query: `${subject} ${modifier}`,
            type: 'broad',
            subject: subject,
            modifier: modifier
          });
        }
      }
    } else if (phase === 'targeted') {
      // Get recent events for targeted search
      const recentEvents = await this.getRecentEvents(24); // last 24 hours
      
      for (const event of recentEvents) {
        const targetedQueries = await this.generateTargetedQueries(event);
        queries.push(...targetedQueries);
      }
    }

    return queries;
  }

  async generateTargetedQueries(event) {
    const prompt = `Given this conflict event, generate 5 specific search queries to find corroboration or updates:

    Event: ${event.summary}
    Actor: ${event.actor}
    Location: ${event.location}
    Date: ${event.estimated_date}

    Generate queries that would find:
    1. Corroboration from other sources
    2. Casualty reports
    3. Government responses
    4. International reactions
    5. Follow-up developments

    Return as JSON array of strings.`;

    const response = await this.llm.complete(prompt);
    const generatedQueries = JSON.parse(response);
    
    return generatedQueries.map(q => ({
      query: q,
      type: 'targeted',
      parent_event_id: event.id,
      subject: event.location,
      modifier: 'targeted'
    }));
  }

  async updateActiveSubjects(newEvents) {
    // Add new conflict zones to active subjects
    for (const event of newEvents) {
      const subject = this.deriveSubject(event);
      if (subject && !this.activeSubjects.has(subject)) {
        this.activeSubjects.add(subject);
        console.log(`Added new active subject: ${subject}`);
      }
    }
  }

  deriveSubject(event) {
    // Create subject from location + conflict type
    const location = event.location;
    const category = event.event_category;
    
    if (location && location !== 'unknown') {
      return `${location} ${category}`;
    }
    return null;
  }
}
```

### 5. Re-ingestion Loop Controller

```javascript
class ReingestionController {
  constructor(pipeline) {
    this.pipeline = pipeline;
    this.processedQueries = new Set();
  }

  async runReingestionCycle() {
    console.log("Starting re-ingestion cycle...");
    
    // 1. Get events from last cycle
    const recentEvents = await this.pipeline.getRecentEvents(6); // last 6 hours
    
    // 2. Generate targeted queries
    const targetedQueries = await this.pipeline.searchEngine.generateSearchQueries('targeted');
    
    // 3. Filter out already-processed queries
    const newQueries = targetedQueries.filter(q => 
      !this.processedQueries.has(q.query)
    );
    
    console.log(`Generated ${newQueries.length} new targeted queries`);
    
    // 4. Execute searches
    for (const queryObj of newQueries) {
      const articles = await this.pipeline.searchFunction(queryObj.query);
      
      // 5. Process through full pipeline
      await this.pipeline.processArticles(articles, queryObj);
      
      this.processedQueries.add(queryObj.query);
    }
    
    // 6. Update active subjects based on new events
    const newEvents = await this.pipeline.getNewEventsSince(this.lastCycleTime);
    await this.pipeline.searchEngine.updateActiveSubjects(newEvents);
    
    this.lastCycleTime = new Date();
  }
}
```

### 6. Bias Analysis Module

```javascript
class BiasAnalyzer {
  constructor(supabase) {
    this.supabase = supabase;
    this.biasDatabase = this.loadBiasDatabase();
  }

  async analyzeArticleBias(article, source, authors) {
    const biasComponents = {
      source_bias: source.bias_score,
      source_reliability: source.reliability_score,
      author_biases: await this.getAuthorBiases(authors),
      content_sentiment: await this.analyzeContentSentiment(article.content),
      language_bias: await this.analyzeLanguageBias(article.content)
    };

    // Calculate weighted bias score
    const weightedBias = this.calculateWeightedBias(biasComponents);
    
    return {
      overall_bias: weightedBias,
      components: biasComponents,
      confidence: this.calculateBiasConfidence(biasComponents)
    };
  }

  async analyzeLanguageBias(content) {
    // Detect loaded language, emotional terms, one-sided reporting
    const biasIndicators = {
      emotional_language: this.detectEmotionalLanguage(content),
      passive_voice_bias: this.detectPassiveVoiceBias(content),
      source_diversity: this.measureSourceDiversity(content),
      adjective_bias: this.detectAdjectiveBias(content)
    };

    return this.aggregateBiasIndicators(biasIndicators);
  }

  detectEmotionalLanguage(content) {
    const emotionalTerms = {
      strong_negative: ['massacre', 'slaughter', 'atrocity', 'barbaric', 'heinous'],
      negative: ['attack', 'assault', 'strike', 'killed', 'destroyed'],
      neutral: ['incident', 'event', 'occurred', 'reported', 'stated'],
      positive: ['liberated', 'defended', 'protected', 'secured', 'achieved'],
      strong_positive: ['heroic', 'brave', 'victorious', 'triumphant']
    };

    // Count occurrences and calculate bias
    // Return -1 to 1 score
  }
}
```

### 7. Main Pipeline Orchestrator

```javascript
class ArgosV2Pipeline {
  constructor(config) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.llm = new OpenAI(config.openaiKey); // or Claude
    
    // Initialize modules
    this.ingestion = new ArticleIngestion(this.supabase);
    this.extractor = new MultiEventExtractor(this.supabase, this.llm);
    this.searchEngine = new DynamicSearchEngine(this.supabase, this.llm);
    this.biasAnalyzer = new BiasAnalyzer(this.supabase);
    this.reingestion = new ReingestionController(this);
    
    this.searchFunction = config.searchFunction;
  }

  async runPipeline() {
    console.log("=== ARGOS V2 PIPELINE STARTING ===");
    
    // Phase 1: Broad Search
    const broadQueries = await this.searchEngine.generateSearchQueries('broad');
    console.log(`Generated ${broadQueries.length} broad queries`);
    
    let totalArticles = 0;
    let totalEvents = 0;
    
    for (const queryObj of broadQueries) {
      // Search
      const articles = await this.searchFunction(queryObj.query);
      totalArticles += articles.length;
      
      // Process each article
      for (const rawArticle of articles) {
        const processedArticle = await this.ingestion.ingestArticle(rawArticle, queryObj.query);
        
        // Extract multiple events
        const events = await this.extractor.extractEventsFromArticle(processedArticle);
        totalEvents += events.length;
        
        // Save events
        for (const event of events) {
          await this.saveEvent(event);
        }
        
        // Analyze bias
        const biasAnalysis = await this.biasAnalyzer.analyzeArticleBias(
          processedArticle,
          processedArticle.source,
          processedArticle.authors
        );
        
        await this.saveBiasAnalysis(processedArticle.id, biasAnalysis);
      }
    }
    
    console.log(`Phase 1 complete: ${totalArticles} articles, ${totalEvents} events`);
    
    // Phase 2: Re-ingestion Loop
    await this.reingestion.runReingestionCycle();
    
    // Phase 3: Event Grouping & Corroboration
    await this.groupAndCorroborateEvents();
    
    return {
      articles_processed: totalArticles,
      events_extracted: totalEvents,
      queries_executed: broadQueries.length
    };
  }

  async groupAndCorroborateEvents() {
    // Get ungrouped events
    const ungroupedEvents = await this.getUngroupedEvents();
    
    // Group by similarity
    const groups = await this.createEventGroups(ungroupedEvents);
    
    // Generate headlines
    for (const group of groups) {
      group.generated_headline = await this.generateHeadline(group);
      await this.saveEventGroup(group);
    }
  }
}
```

## 📝 USAGE EXAMPLE

```javascript
import ArgosV2Pipeline from './argos-v2-pipeline.js';

const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  openaiKey: process.env.OPENAI_KEY,
  searchFunction: async (query) => {
    // Your search implementation
    const results = await fetch(`/search?q=${query}`);
    return results.json();
  }
};

const pipeline = new ArgosV2Pipeline(config);

// Run full pipeline
const results = await pipeline.runPipeline();

// Or run specific phases
await pipeline.searchEngine.generateSearchQueries('targeted');
await pipeline.reingestion.runReingestionCycle();
```

## 🎯 KEY IMPROVEMENTS

1. **Multi-Event Extraction**: Properly extracts ALL events from each article
2. **Named Entity Registry**: Tracks all people, places, organizations, weapons
3. **Dynamic Search**: Learns from extracted events to generate new searches
4. **Proper Data Model**: Normalized database with proper relationships
5. **Bias Analysis**: Multi-factor bias scoring including source, author, and content
6. **Re-ingestion Loop**: Continuously finds corroborating information
7. **Attribution Tracking**: Knows who said what and when
8. **Temporal Precision**: Handles "yesterday", "last night" with confidence intervals
9. **Event Categorization**: Structured taxonomy of conflict event types
10. **Full Audit Trail**: Every search query and result is logged

## 🚀 NEXT STEPS

1. Implement each module as a separate file
2. Set up Supabase tables with provided schema
3. Integrate your preferred LLM (OpenAI/Claude)
4. Add your search function (RSS/API/Web scraping)
5. Run initial tests with sample articles
6. Deploy re-ingestion loop as scheduled job
7. Build dashboard to visualize extracted events

This architecture is production-ready and handles the full complexity of real-world conflict reporting.