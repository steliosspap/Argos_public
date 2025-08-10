# OSINT Ingestion Pipeline Technical Specification

## Executive Summary

The OSINT (Open Source Intelligence) Ingestion Pipeline is a sophisticated real-time conflict intelligence system that collects, processes, and analyzes global news data to extract structured conflict events. The system monitors over 400 global news sources in multiple languages, uses AI-powered analysis to extract conflict events, and provides real-time alerts for critical situations.

### Key Capabilities
- **Real-time monitoring** of global conflict events from 400+ news sources
- **AI-powered event extraction** using GPT-4 for high accuracy
- **Multi-language support** across major world languages
- **Geospatial intelligence** with precise location resolution
- **Automated deduplication** and event clustering
- **Critical event alerting** for high-severity incidents
- **Source reliability tracking** with automatic quality control

## System Architecture Overview

```ascii
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           OSINT INGESTION PIPELINE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐             │
│  │   News API      │      │  Google Search  │      │   RSS Feeds     │             │
│  │                 │      │      API        │      │   (400+ sources)│             │
│  └────────┬────────┘      └────────┬────────┘      └────────┬────────┘             │
│           │                         │                         │                       │
│           └─────────────────────────┴─────────────────────────┘                      │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │  Article Collector  │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │ Deduplication │  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └──────────┬──────────┘                                     │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │   Text Processor    │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │ NLP Analysis  │  │                                     │
│                          │  │ Entity Extract│  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └──────────┬──────────┘                                     │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │  Event Extractor    │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │   GPT-4 AI    │  │                                     │
│                          │  │Pattern Match  │  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └──────────┬──────────┘                                     │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │ Geospatial Service  │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │Location Resol.│  │                                     │
│                          │  │  Geocoding    │  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └──────────┬──────────┘                                     │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │  Event Clustering   │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │ Deduplication │  │                                     │
│                          │  │  Similarity   │  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └──────────┬──────────┘                                     │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │   Database Layer    │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │Supabase/PgSQL │  │                                     │
│                          │  │   PostGIS     │  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └──────────┬──────────┘                                     │
│                                     │                                                 │
│                          ┌──────────▼──────────┐                                     │
│                          │   Alert System      │                                     │
│                          │  ┌───────────────┐  │                                     │
│                          │  │Critical Events│  │                                     │
│                          │  │ Notifications │  │                                     │
│                          │  └───────────────┘  │                                     │
│                          └─────────────────────┘                                     │
│                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```ascii
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DETAILED DATA FLOW PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  1. QUERY GENERATION                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │  Conflict Zones → Query Templates → Time Modifiers → Search Queries │             │
│  │    (Ukraine)        (military)       (today)        (20 queries)   │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                     │                                                 │
│  2. DATA COLLECTION                 ▼                                                 │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐                    │
│  │   Google API   │    │   News API     │    │   RSS Parser    │                    │
│  │  ┌──────────┐  │    │  ┌──────────┐  │    │  ┌──────────┐  │                    │
│  │  │20 queries│  │    │  │Keywords  │  │    │  │400 feeds │  │                    │
│  │  │3-day hist│  │    │  │24-hr win │  │    │  │72-hr win │  │                    │
│  │  └──────────┘  │    │  └──────────┘  │    │  └──────────┘  │                    │
│  └───────┬────────┘    └───────┬────────┘    └───────┬────────┘                    │
│          └──────────────────────┴──────────────────────┘                             │
│                                     │                                                 │
│  3. DEDUPLICATION                   ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │     URL Hash → Content Hash → Time Window Check → Unique Articles  │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                     │                                                 │
│  4. TEXT PROCESSING                 ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │  HTML Clean → Language Detect → Relevance Score → Entity Extract   │             │
│  │                                                    ┌──────────────┐ │             │
│  │                                                    │ • Persons    │ │             │
│  │                                                    │ • Locations  │ │             │
│  │                                                    │ • Weapons    │ │             │
│  │                                                    │ • Casualties │ │             │
│  │                                                    └──────────────┘ │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                     │                                                 │
│  5. AI ANALYSIS (GPT-4)             ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │   Article Text → Structured Prompt → JSON Response → Event Object  │             │
│  │                    ┌─────────────────────────┐                     │             │
│  │                    │ • Enhanced headline     │                     │             │
│  │                    │ • Conflict type         │                     │             │
│  │                    │ • Severity score        │                     │             │
│  │                    │ • Actors & casualties   │                     │             │
│  │                    │ • Location & confidence │                     │             │
│  │                    └─────────────────────────┘                     │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                     │                                                 │
│  6. LOCATION RESOLUTION             ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │  Text Location → Enhanced Mappings → Geocoding APIs → Coordinates  │             │
│  │   "Gaza City"      (Verified DB)      (Nominatim)    31.5,34.46   │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                     │                                                 │
│  7. EVENT CLUSTERING                ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │  Similarity Matrix → Threshold Check → Event Groups → Primary Event│             │
│  │   ┌────────────┐      (>0.7)         ┌────────┐                   │             │
│  │   │• Temporal  │                     │Group 1 │                   │             │
│  │   │• Geographic│                     │Group 2 │                   │             │
│  │   │• Actors    │                     │Group 3 │                   │             │
│  │   └────────────┘                     └────────┘                   │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                     │                                                 │
│  8. DATABASE STORAGE                ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐             │
│  │  Events Table → Event Groups → Sources → Search Queries → Stats    │             │
│  │   (PostGIS)      (Relations)   (Health)   (History)    (Metrics)  │             │
│  └────────────────────────────────────────────────────────────────────┘             │
│                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Component Documentation

### 1. Ingestion Service (Core Orchestrator)

The `IngestionService` class serves as the main orchestrator for the entire pipeline.

**Key Methods:**
- `ingest()` - Main entry point that coordinates the entire pipeline
- `initializeSources()` - Loads and validates news sources
- `generateSearchQueries()` - Creates dynamic queries based on conflict zones
- `collectArticles()` - Gathers articles from all sources
- `processArticles()` - Extracts events from articles
- `clusterEvents()` - Groups similar events
- `storeResults()` - Persists data to database
- `generateAlerts()` - Creates notifications for critical events

**Configuration:**
```javascript
{
  maxConcurrentRequests: 10,
  batchSize: 50,
  deduplicationWindow: 24 * 60 * 60 * 1000, // 24 hours
  retryAttempts: 3,
  retryDelay: 5000
}
```

### 2. Event Extractor (AI-Powered Analysis)

The `EventExtractor` uses GPT-4 to analyze articles and extract structured conflict events.

**AI Prompt Structure:**
```javascript
{
  role: "conflict analyst",
  task: "extract structured event data",
  output_format: {
    enhanced_headline: "WHO did WHAT to WHOM, WHERE, WHEN",
    conflict_type: "armed_conflict|terrorism|military_operation|...",
    severity_score: 1-10,
    escalation_score: 1-10,
    casualties: { killed: number, wounded: number },
    primary_actors: ["actor1", "actor2"],
    location: { name: string, country: string, coordinates: [lat, lng] },
    verification_confidence: "high|medium|low"
  }
}
```

**Fallback Pattern Matching:**
- Casualty patterns: `/(\d+)\s*(?:people|persons?)\s*(?:killed|dead)/i`
- Weapon patterns: `/missile|drone|airstrike|bombing|shelling/i`
- Location patterns: Extract proper nouns near prepositions

### 3. Text Processor (NLP Engine)

The `TextProcessor` handles natural language processing tasks.

**Entity Extraction Pipeline:**
1. **Pattern-based extraction** for known entities
2. **AI-based extraction** using OpenAI for complex entities
3. **Validation and normalization** of extracted data

**Temporal Processing:**
- Parses relative dates ("yesterday", "last week")
- Extracts explicit timestamps
- Assigns confidence scores to temporal data

**Relevance Scoring:**
```javascript
scoreRelevance(text) {
  const conflictKeywords = ['military', 'attack', 'killed', 'conflict', ...];
  const keywordMatches = countMatches(text, conflictKeywords);
  const lengthFactor = Math.min(text.length / 1000, 1);
  return keywordMatches * 0.7 + lengthFactor * 0.3;
}
```

### 4. Geospatial Service (Location Intelligence)

The `EnhancedGeospatialService` provides multi-strategy location resolution.

**Resolution Hierarchy:**
1. **Verified event database** - Pre-validated conflict locations
2. **Enhanced mappings** - Specific landmarks and facilities
3. **Base mappings** - Major cities and regions
4. **Relative parsing** - "10km north of City"
5. **Geocoding APIs** - Nominatim and Google fallback

**Location Confidence Scoring:**
```javascript
{
  verified_match: 1.0,
  enhanced_mapping: 0.9,
  base_mapping: 0.8,
  relative_location: 0.7,
  geocoding_api: 0.6,
  pattern_extraction: 0.5
}
```

### 5. Event Clustering (Deduplication Engine)

The clustering system groups related events to reduce duplication.

**Similarity Calculation:**
```javascript
similarity = (
  temporal_similarity * 0.3 +
  geographic_similarity * 0.4 +
  actor_similarity * 0.2 +
  event_type_similarity * 0.1
)
```

**Clustering Algorithm:**
1. Calculate pairwise similarities between all events
2. Group events with similarity > 0.7
3. Select primary event (highest reliability)
4. Merge supplementary data from grouped events
5. Calculate group confidence score

### 6. Source Management System

**Source Health Tracking:**
```javascript
{
  reliability_score: 0-100,       // Historical accuracy
  health_score: 0.0-1.0,         // Current operational status
  consecutive_failures: number,   // Failure counter
  last_successful_fetch: Date,
  daily_access_count: number,
  geographic_expertise: ["regions"],
  bias_score: -1 to 1            // Political bias indicator
}
```

**Automatic Source Management:**
- Deactivates sources after 10 consecutive failures
- Adjusts reliability based on accuracy metrics
- Enforces rate limits per source
- Prioritizes high-reliability sources

## Database Schema

### Events Table
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  location GEOGRAPHY(POINT, 4326),  -- PostGIS point
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name TEXT,
  country VARCHAR(100),
  region VARCHAR(100),
  timestamp TIMESTAMP WITH TIME ZONE,
  timestamp_confidence VARCHAR(20),
  event_type VARCHAR(50),
  conflict_type VARCHAR(50),
  severity INTEGER CHECK (severity BETWEEN 1 AND 10),
  escalation_score INTEGER CHECK (escalation_score BETWEEN 1 AND 10),
  casualties JSONB,  -- {killed: n, wounded: m, missing: p}
  enhanced_headline TEXT,
  description TEXT,
  participants TEXT[],
  primary_actors TEXT[],
  source_urls TEXT[],
  reliability DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial index for location queries
CREATE INDEX idx_events_location ON events USING GIST(location);
-- Temporal index for time-based queries
CREATE INDEX idx_events_timestamp ON events(timestamp);
-- Severity index for critical event queries
CREATE INDEX idx_events_severity ON events(severity);
```

### Event Groups Table
```sql
CREATE TABLE event_groups (
  id UUID PRIMARY KEY,
  event_ids UUID[],
  primary_event_id UUID REFERENCES events(id),
  group_confidence DOUBLE PRECISION,
  corroboration_count INTEGER,
  source_diversity_score DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Sources Table
```sql
CREATE TABLE news_sources (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  url TEXT,
  feed_url TEXT,
  language VARCHAR(10),
  country VARCHAR(100),
  source_type VARCHAR(50),
  categories TEXT[],
  reliability_score INTEGER,
  bias_score DOUBLE PRECISION,
  health_score DOUBLE PRECISION DEFAULT 1.0,
  consecutive_failures INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  last_successful_fetch TIMESTAMP WITH TIME ZONE,
  daily_access_count INTEGER DEFAULT 0,
  rate_limit_per_hour INTEGER,
  geographic_expertise TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Handling & Resilience

### Retry Strategy
```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i); // Exponential backoff
      await sleep(delay);
    }
  }
}
```

### Error Categories
1. **API Errors** - Rate limits, authentication, network
2. **Processing Errors** - AI failures, parsing errors
3. **Storage Errors** - Database connectivity, constraints
4. **Source Errors** - RSS parse failures, blocked access

### Graceful Degradation
- Continue processing despite individual failures
- Fall back to pattern matching if AI fails
- Use cached data when sources unavailable
- Maintain partial results for incomplete processing

## Performance Optimization

### Concurrency Control
- Maximum 10 concurrent API requests
- Batch processing in groups of 50
- Inter-batch delays to prevent overload
- Source-specific rate limiting

### Caching Strategy
- 24-hour cache for search results
- API response caching
- Location resolution caching
- Source metadata caching

### Database Optimization
- PostGIS spatial indexing for location queries
- Temporal indexing for time-based searches
- JSONB indexing for casualty queries
- Materialized views for common aggregations

## Monitoring & Alerting

### Real-time Statistics
```javascript
{
  pipeline_metrics: {
    articles_per_minute: number,
    events_per_hour: number,
    average_processing_time: milliseconds,
    error_rate: percentage
  },
  source_metrics: {
    active_sources: number,
    failed_sources: number,
    average_reliability: percentage
  },
  event_metrics: {
    critical_events_today: number,
    total_casualties: number,
    active_conflict_zones: number
  }
}
```

### Alert Triggers
- Severity score ≥ 7
- Casualty count > 10 killed
- Escalation score ≥ 8
- New conflict zone detected
- Source failure rate > 50%

## Security Considerations

### API Key Management
- Environment variable storage
- Rotation reminders
- Usage monitoring
- Rate limit enforcement

### Data Validation
- Input sanitization for all external data
- SQL injection prevention via parameterized queries
- XSS protection for stored content
- Schema validation for API responses

### Access Control
- Source authentication where required
- Database connection pooling
- Read-only access for reporting
- Audit logging for modifications

## Deployment & Operations

### Execution Modes
1. **Single Run** - One-time execution
2. **Development** - Continuous with hot reload
3. **Production** - Scheduled via cron
4. **Monitoring** - Real-time dashboard mode

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "cli.js", "ingest"]
```

### Cron Configuration
```bash
# Run every 30 minutes
*/30 * * * * cd /path/to/osint && node cli.js ingest >> logs/ingestion.log 2>&1
```

### Environment Variables
```bash
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
GOOGLE_CSE_ID=...
NEWS_API_KEY=...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
NODE_ENV=production
LOG_LEVEL=info
```

## Maintenance & Troubleshooting

### Common Issues
1. **High API costs** - Reduce query frequency or implement caching
2. **Slow processing** - Increase concurrency or optimize queries
3. **Location failures** - Update mapping database
4. **Source blocking** - Rotate user agents or implement proxies

### Health Checks
```javascript
async function systemHealthCheck() {
  return {
    database: await checkDatabaseConnection(),
    apis: await checkAPIKeys(),
    sources: await checkSourceHealth(),
    diskSpace: await checkDiskSpace(),
    memory: process.memoryUsage()
  };
}
```

### Log Analysis
- Error patterns by source
- Processing time trends
- API usage statistics
- Event extraction success rates

## Future Enhancements

### Planned Features
1. **Multi-language AI models** for better international coverage
2. **Social media integration** for real-time updates
3. **Satellite imagery correlation** for event verification
4. **Predictive analytics** for conflict escalation
5. **GraphQL API** for flexible data access
6. **WebSocket subscriptions** for real-time updates
7. **Machine learning** for source reliability scoring
8. **Blockchain verification** for event authenticity

### Scalability Roadmap
- Kubernetes deployment for horizontal scaling
- Message queue integration (RabbitMQ/Kafka)
- Distributed caching (Redis cluster)
- Read replica databases
- CDN for static assets
- Microservices architecture

## Conclusion

The OSINT Ingestion Pipeline represents a state-of-the-art system for real-time conflict intelligence gathering. Its modular architecture, AI-powered analysis, and robust error handling ensure reliable operation at scale. The system's ability to process hundreds of sources in multiple languages while maintaining high accuracy makes it an invaluable tool for security analysis and situational awareness.

For questions or support, contact the development team at [support email].

---
*Document Version: 1.0*  
*Last Updated: January 2025*  
*Classification: Technical Specification*