# OSINT Ingestion Pipeline - Comprehensive Architecture Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Sources](#data-sources)
5. [Processing Pipeline](#processing-pipeline)
6. [Storage Mechanisms](#storage-mechanisms)
7. [Configuration](#configuration)
8. [Error Handling & Monitoring](#error-handling--monitoring)
9. [Deployment & Operations](#deployment--operations)
10. [API Integration](#api-integration)

## Overview

The OSINT (Open Source Intelligence) ingestion pipeline is a sophisticated system designed to collect, process, and analyze conflict-related news and events from multiple global sources. It serves as the data backbone for the ARGOS platform.

### Key Features
- **Multi-source ingestion**: RSS feeds, News APIs, Google Custom Search
- **Multi-language support**: Processes content in 10+ languages
- **AI-powered analysis**: Uses GPT-4o for event extraction and classification
- **Real-time processing**: Continuous monitoring with 15-minute cycles
- **Geospatial resolution**: Enhanced location extraction with coordinates
- **Deduplication**: Intelligent clustering of similar events
- **Reliability scoring**: Source and content verification

## Architecture

### System Flow
```
Data Sources → Ingestion Service → Processing Pipeline → Storage → Frontend API
     ↓              ↓                    ↓                 ↓          ↓
   RSS Feeds    Collection          Text Analysis      Supabase    Next.js
   News APIs    Filtering           Event Extraction   PostgreSQL  React App
   Search APIs  Deduplication       Geocoding
                                   AI Classification
```

### Directory Structure
```
osint-ingestion/
├── cli.js                    # Main CLI entry point
├── services/                 # Core service modules
│   ├── IngestionService.js   # Main orchestrator
│   ├── EventExtractor.js     # Event extraction logic
│   ├── TextProcessor.js      # NLP processing
│   ├── GeospatialService.js  # Location resolution
│   └── EnhancedGeospatialService.js  # Advanced geocoding
├── models/                   # Data models
│   ├── Event.js             # Conflict event model
│   └── Source.js            # News source model
├── core/
│   └── config.js            # Central configuration
├── utils/
│   └── sources/
│       └── global-news-sources.js  # RSS feed definitions
├── scripts/                 # Utility scripts
├── sql/                     # Database schemas
└── docs/                    # Documentation
```

## Core Components

### 1. CLI Interface (`cli.js`)
The command-line interface provides multiple commands:

```bash
# Main commands
osint-pipeline ingest        # Run ingestion cycle
osint-pipeline sources       # Manage news sources
osint-pipeline events        # Query events
osint-pipeline monitor       # Continuous monitoring
osint-pipeline test          # Test components
```

**Features:**
- Verbose/dry-run modes
- Source filtering
- Progress visualization
- Real-time monitoring
- Alert generation

### 2. Ingestion Service (`services/IngestionService.js`)
The main orchestrator that coordinates the entire pipeline:

**Key Methods:**
- `ingest()`: Main ingestion cycle
- `generateSearchQueries()`: Creates targeted search queries
- `collectArticles()`: Gathers articles from all sources
- `processArticles()`: Analyzes and extracts events
- `clusterEvents()`: Groups similar events
- `storeResults()`: Saves to database

**Statistics Tracking:**
- Articles searched
- Articles fetched
- Articles analyzed
- Events extracted
- Errors encountered

### 3. Event Extractor (`services/EventExtractor.js`)
Extracts structured conflict events from articles:

**Process:**
1. Relevance classification
2. Entity extraction (people, organizations, locations)
3. Temporal information extraction
4. AI-powered analysis using GPT-4o
5. Pattern-based fallback extraction
6. Event object creation with all metadata

**Event Types:**
- military_action
- terrorist_attack
- civil_unrest
- military_exercise
- diplomatic

### 4. Text Processor (`services/TextProcessor.js`)
Handles all NLP tasks:

**Capabilities:**
- Language detection
- Entity extraction (regex + AI)
- Temporal expression parsing
- Conflict relevance scoring
- Factual claim extraction
- Text similarity calculation

**Pattern Matching:**
- Casualties detection
- Weapons identification
- Military unit recognition
- Location extraction
- Date/time parsing

### 5. Geospatial Service (`services/EnhancedGeospatialService.js`)
Advanced location resolution:

**Features:**
- Multi-strategy resolution
- Context-aware geocoding
- Coordinate validation
- PostGIS integration
- Fallback mechanisms

## Data Sources

### 1. RSS Feeds (`utils/sources/global-news-sources.js`)
Over 400 RSS feeds organized by:

**Categories:**
- `international`: Major global news outlets
- `defense_intelligence`: Military/defense focused
- `conflict_monitoring`: Specialized conflict trackers
- Regional: `middle_east`, `africa`, `asia_pacific`, etc.
- Language-specific: Russian, Chinese, Arabic, Spanish, etc.

**High-Priority Sources:**
- Reuters, BBC, Al Jazeera
- Defense News, Jane's
- ACLED, Crisis Group
- Regional conflict monitors

### 2. Google Custom Search API
Generates dynamic queries based on:
- Active conflict zones
- Breaking news keywords
- Temporal modifiers
- Casualty indicators

**Query Templates:**
```javascript
"{location} military conflict today"
"{location} casualties killed wounded"
"{location} missile strike bombing latest"
```

### 3. News API Integration
Searches for conflict keywords:
- Military actions
- Casualties
- Weapons usage
- Ceasefire violations

## Processing Pipeline

### 1. Article Collection Phase
```javascript
// Parallel collection from multiple sources
const articles = await Promise.all([
  searchGoogle(queries),
  fetchRSSFeeds(),
  fetchNewsAPI()
]);
```

### 2. Filtering & Deduplication
- URL-based deduplication
- Content hash generation
- Relevance scoring (min 0.3)
- Time window filtering (72 hours)

### 3. AI Analysis
**GPT-4o Prompt Structure:**
```
1. Is this military/armed conflict?
2. Extract:
   - Enhanced headline (WHO did WHAT to WHOM, WHERE, WHEN)
   - Conflict type
   - Primary actors
   - Location details
   - Severity (low/medium/high/critical)
   - Escalation score (1-10)
   - Casualties
   - Verification confidence
```

### 4. Event Clustering
Groups similar events based on:
- Temporal proximity (6-hour window)
- Geographic proximity (50km radius)
- Actor overlap
- Event type similarity

**Similarity Calculation:**
- Temporal: 30% weight
- Geographic: 40% weight
- Actors: 20% weight
- Type: 10% weight

## Storage Mechanisms

### 1. Event Model (`models/Event.js`)
**Key Fields:**
```javascript
{
  id: UUID,
  title: String,
  enhancedHeadline: String,
  timestamp: Date,
  location: PostGIS GEOGRAPHY,
  latitude/longitude: Float,
  locationName: String,
  country/region: String,
  eventType: String,
  severity: Enum,
  escalationScore: Integer (1-10),
  casualties: {killed, wounded},
  reliability: Float (0-1),
  primaryActors: Array,
  source: String,
  tags: Array
}
```

### 2. Source Model (`models/Source.js`)
**Tracks:**
- Reliability score (0-100)
- Bias score (-1 to 1)
- Access metrics
- Health score
- Geographic expertise
- Update frequency

### 3. Database Schema
**Tables:**
- `events`: Main event storage
- `news_sources`: Source metadata
- `event_groups`: Event clustering
- `search_queries`: Query tracking

## Configuration

### Central Config (`core/config.js`)
**Sections:**
1. **APIs**: OpenAI, Google, NewsAPI keys
2. **Database**: Supabase connection
3. **Processing**: Thresholds, limits, windows
4. **Conflict Zones**: Active/monitoring regions
5. **NLP**: Keywords, patterns, expressions
6. **Alerts**: Thresholds, webhooks


## Error Handling & Monitoring

### 1. Error Tracking
- Per-source error counting
- Consecutive failure tracking
- Automatic source deactivation
- Error categorization

### 2. Health Monitoring
**Metrics:**
- Source health scores
- Success/failure rates
- Response times
- Content quality

### 3. Logging
- Verbose mode for debugging
- Statistics summary
- Critical event alerts
- Performance metrics

### 4. Resilience Features
- Retry mechanisms
- Fallback strategies
- Rate limiting
- Graceful degradation

## Deployment & Operations

### 1. Execution Modes
```bash
# One-time execution
npm start

# Development mode
npm run dev

# Continuous monitoring
npm run monitor

# Docker deployment
docker-compose up -d
```

### 2. Cron/Scheduled Execution
```bash
# Setup cron job
./setup-cron.sh

# GitHub Actions (runs every 30 minutes)
.github/workflows/news-ingestion.yml
```

### 3. Performance Optimization
- Concurrent request limiting
- Memory management
- Database connection pooling
- Batch processing

## API Integration

### 1. Frontend Integration
The pipeline provides data to Next.js frontend via Supabase:

```javascript
// Real-time events
const { data: events } = await supabase
  .from('events')
  .select('*')
  .order('timestamp', { ascending: false })
  .limit(100);

// Filtered by severity
const criticalEvents = await supabase
  .from('events')
  .select('*')
  .in('severity', ['critical', 'high']);
```

### 2. REST API Endpoints
Available through Next.js API routes:
- `/api/events` - Get events
- `/api/news` - Get news articles
- `/api/ingest` - Trigger ingestion
- `/api/events/geojson` - GeoJSON format

### 3. Real-time Updates
Supabase real-time subscriptions:
```javascript
const subscription = supabase
  .from('events')
  .on('INSERT', payload => {
    // Handle new event
  })
  .subscribe();
```

## Best Practices

### 1. Source Management
- Regular source health reviews
- Bias tracking and adjustment
- Performance optimization
- New source evaluation

### 2. Content Quality
- Verification through multiple sources
- Confidence scoring
- Fact checking integration
- Attribution tracking

### 3. Scalability
- Horizontal scaling via workers
- Database partitioning
- Cache implementation
- CDN for static assets

### 4. Security
- API key rotation
- Rate limiting
- Input sanitization
- Access control

## Future Enhancements

1. **Machine Learning**
   - Custom NER models
   - Improved event classification
   - Bias detection
   - Credibility scoring

2. **Additional Sources**
   - Social media integration
   - Telegram channels
   - Government feeds
   - NGO reports

3. **Advanced Analytics**
   - Trend detection
   - Predictive modeling
   - Network analysis
   - Sentiment tracking

4. **Performance**
   - Redis caching
   - Elasticsearch integration
   - GraphQL API
   - WebSocket streaming