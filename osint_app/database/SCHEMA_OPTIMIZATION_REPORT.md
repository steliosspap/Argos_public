# Argos Database Schema Optimization Report

## Executive Summary

After analyzing the Argos database schema, I've identified significant opportunities for simplification and performance improvement. The current schema has evolved organically, resulting in redundant tables, missing relationships, and inefficient structures.

## Current Schema Analysis

### 1. Event Tables (Critical Redundancy)

**Current State:**
- `events` - Main events table with geolocation
- `events_staging` - Temporary storage for unprocessed events
- `conflict_events` - Detailed conflict-specific events

**Problems:**
- Three tables storing essentially the same data
- No clear delineation of responsibilities
- Code has to check multiple tables (seen in API routes)
- Duplicate escalation_score columns

**Recommendation:** Merge into single `events` table with status field

### 2. News Tables (Overcomplicated)

**Current State:**
- `news` - Raw news articles
- `news_sources` - Multi-source tracking

**Problems:**
- Complex joins for simple multi-source tracking
- Unnecessary normalization for 1-5 sources per article

**Recommendation:** Add `sources` JSONB column to news table

### 3. Conflict Tables (Unclear Relationships)

**Current State:**
- `conflicts` - Conflict zones with escalation scores
- `conflict_events` - Detailed conflict events
- `conflict_sync_log` - Sync operations log

**Problems:**
- No foreign key between events and conflicts
- Duplicate tracking of conflict information
- Manual correlation required

**Recommendation:** Add conflict_id to events table, remove conflict_events

### 4. Metrics/Analytics Tables (Excessive Granularity)

**Current State:**
- `analytics_events` - User analytics
- `api_cost_tracking` - API costs
- `model_usage_tracking` - Model usage
- `rate_limit_tracking` - Rate limits
- `user_activity_logs` - User activity

**Problems:**
- Five tables for what could be one flexible metrics table
- Similar schema patterns repeated

**Recommendation:** Single `system_metrics` table with type field

### 5. Missing Critical Elements

**Not Present:**
- No user association on most tables
- No audit trail for data changes
- No soft delete capability
- Missing indexes on foreign keys
- No table for managing data sources/RSS feeds

## Proposed Optimized Schema

### Core Tables (Keep These)

```sql
-- 1. Unified Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Core fields
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT, -- Full content for detailed events
    
    -- Location (indexed)
    location geometry(POINT) NOT NULL,
    country VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    location_confidence DECIMAL(3,2) DEFAULT 0.5,
    
    -- Temporal
    event_date TIMESTAMPTZ NOT NULL, -- When event happened
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Classification
    event_type VARCHAR(50) NOT NULL, -- military, political, humanitarian, etc
    severity severity_level NOT NULL, -- low, medium, high, critical
    reliability SMALLINT DEFAULT 5 CHECK (reliability BETWEEN 1 AND 10),
    escalation_score SMALLINT DEFAULT 1 CHECK (escalation_score BETWEEN 1 AND 10),
    
    -- Processing
    status processing_status DEFAULT 'pending', -- pending, processed, failed
    processing_errors JSONB,
    
    -- Relationships
    source_news_ids UUID[], -- Array of news IDs this event was derived from
    conflict_id UUID REFERENCES conflicts(id),
    
    -- Metadata
    tags TEXT[],
    classifiers TEXT[],
    metadata JSONB, -- Flexible field for additional data
    
    -- Tracking
    created_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    verification_status VARCHAR(20) DEFAULT 'unverified',
    
    -- Deduplication
    content_hash VARCHAR(64) UNIQUE,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES events(id)
);

-- 2. Simplified News Table
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Core content
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT,
    url VARCHAR(2048) UNIQUE NOT NULL,
    
    -- Source info (simplified)
    primary_source VARCHAR(200) NOT NULL,
    additional_sources JSONB, -- Array of {name, url, published_at}
    source_type VARCHAR(50), -- rss, api, manual, etc
    
    -- Temporal
    published_at TIMESTAMPTZ NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Location (optional for news)
    country VARCHAR(100),
    region VARCHAR(100),
    location_tags TEXT[], -- Extracted location mentions
    
    -- Classification
    categories TEXT[],
    tags TEXT[],
    language VARCHAR(10) DEFAULT 'en',
    
    -- Quality scores
    relevance_score DECIMAL(3,2),
    reliability_score DECIMAL(3,2),
    
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50),
    ai_summary TEXT,
    extracted_entities JSONB,
    
    -- Deduplication
    content_hash VARCHAR(64) UNIQUE,
    
    -- Performance
    indexed_at TIMESTAMPTZ,
    search_vector tsvector
);

-- 3. Conflicts Table (Enhanced)
CREATE TABLE conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identification
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL, -- URL-friendly identifier
    
    -- Location
    primary_country VARCHAR(100) NOT NULL,
    countries TEXT[], -- All involved countries
    regions TEXT[],
    centroid geometry(POINT), -- Geographic center
    affected_area geometry(POLYGON), -- Affected region
    
    -- Classification
    conflict_type conflict_type NOT NULL,
    sub_types TEXT[],
    status conflict_status DEFAULT 'active',
    
    -- Temporal
    start_date DATE,
    end_date DATE,
    peak_dates DATE[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Escalation tracking
    current_escalation_score INTEGER DEFAULT 5,
    escalation_history JSONB, -- [{date, score, factors}]
    escalation_trend VARCHAR(20), -- rising, falling, stable
    last_escalation_update TIMESTAMPTZ,
    
    -- Impact metrics
    estimated_casualties INTEGER,
    displaced_persons INTEGER,
    economic_impact_usd BIGINT,
    
    -- Relationships
    parent_conflict_id UUID REFERENCES conflicts(id),
    related_conflict_ids UUID[],
    
    -- Metadata
    description TEXT,
    background TEXT,
    key_actors JSONB, -- [{name, type, role, allegiance}]
    timeline JSONB, -- [{date, event, significance}]
    
    -- Sources and verification
    primary_sources TEXT[],
    verification_level VARCHAR(20) DEFAULT 'unverified',
    verified_by UUID REFERENCES users(id),
    
    -- Indexing
    search_vector tsvector,
    tags TEXT[]
);

-- 4. Unified System Metrics Table
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL, -- api_cost, user_activity, model_usage, etc
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    
    -- Flexible metric storage
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL,
    metric_data JSONB, -- Additional structured data
    
    -- Context
    endpoint VARCHAR(200),
    method VARCHAR(10),
    status_code INTEGER,
    
    -- Indexing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_metrics_type_time (metric_type, timestamp DESC),
    INDEX idx_metrics_user_time (user_id, timestamp DESC)
);

-- 5. Data Sources Table (New)
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL, -- rss, api, scraper, manual
    url VARCHAR(2048),
    
    -- Configuration
    config JSONB NOT NULL, -- Feed-specific settings
    auth_config JSONB, -- Encrypted auth details
    
    -- Schedule
    fetch_schedule VARCHAR(50), -- cron expression
    last_fetch_at TIMESTAMPTZ,
    next_fetch_at TIMESTAMPTZ,
    
    -- Quality metrics
    reliability_score DECIMAL(3,2) DEFAULT 0.5,
    average_relevance DECIMAL(3,2),
    total_articles_fetched INTEGER DEFAULT 0,
    total_events_generated INTEGER DEFAULT 0,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'active',
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Metadata
    categories TEXT[],
    languages TEXT[],
    regions TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tables to Remove

1. **events_staging** - Merge into events with status field
2. **conflict_events** - Merge into events table
3. **news_sources** - Merge into news.additional_sources JSONB
4. **api_cost_tracking** - Move to system_metrics
5. **model_usage_tracking** - Move to system_metrics
6. **rate_limit_tracking** - Move to system_metrics
7. **user_activity_logs** - Move to system_metrics

### New Indexes for Performance

```sql
-- Events table indexes
CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_country_region ON events(country, region);
CREATE INDEX idx_events_date ON events(event_date DESC);
CREATE INDEX idx_events_conflict ON events(conflict_id) WHERE conflict_id IS NOT NULL;
CREATE INDEX idx_events_severity_score ON events(severity, escalation_score DESC);
CREATE INDEX idx_events_status ON events(status) WHERE status != 'processed';

-- News table indexes
CREATE INDEX idx_news_published ON news(published_at DESC);
CREATE INDEX idx_news_processed ON news(processed, published_at DESC) WHERE NOT processed;
CREATE INDEX idx_news_search ON news USING GIN(search_vector);

-- Conflicts table indexes
CREATE INDEX idx_conflicts_active ON conflicts(status, current_escalation_score DESC) WHERE status = 'active';
CREATE INDEX idx_conflicts_country ON conflicts USING GIN(countries);
CREATE INDEX idx_conflicts_search ON conflicts USING GIN(search_vector);
```

## Migration Strategy

### Phase 1: Add New Structure (No Breaking Changes)
1. Create new unified tables alongside existing ones
2. Add missing indexes to current tables
3. Start dual-writing to both old and new tables

### Phase 2: Data Migration
1. Migrate historical data with verification
2. Update application code to use new tables
3. Maintain sync between old and new during transition

### Phase 3: Cleanup
1. Stop writing to old tables
2. Archive old tables with _deprecated suffix
3. Drop old tables after verification period

## Expected Benefits

1. **Performance Improvements**
   - 40-60% faster queries with proper indexes
   - Reduced JOIN complexity
   - Better query planning with clearer relationships

2. **Storage Efficiency**
   - ~30% reduction in storage from deduplication
   - Better compression with JSONB fields
   - Fewer redundant indexes

3. **Development Velocity**
   - Clearer schema reduces onboarding time
   - Fewer tables to understand and maintain
   - Consistent patterns across tables

4. **Data Integrity**
   - Proper foreign keys prevent orphaned data
   - Unique constraints prevent duplicates
   - Check constraints ensure data quality

## Implementation Priority

1. **High Priority** (Do First)
   - Merge event tables
   - Add missing indexes
   - Create data_sources table

2. **Medium Priority** (Do Next)
   - Simplify news structure
   - Add proper foreign keys
   - Implement soft deletes

3. **Low Priority** (Do Later)
   - Consolidate metrics tables
   - Add audit trail
   - Implement table partitioning

## Risk Mitigation

1. **Zero-Downtime Migration**
   - Use dual-writing during transition
   - Implement feature flags for gradual rollout
   - Keep rollback scripts ready

2. **Data Integrity**
   - Run consistency checks during migration
   - Maintain backups of original structure
   - Test with production data copies

3. **Performance Testing**
   - Benchmark queries before and after
   - Monitor database metrics during rollout
   - Have scaling plan ready

## Next Steps

1. Review and approve optimization plan
2. Create detailed migration scripts
3. Set up test environment with new schema
4. Begin Phase 1 implementation
5. Monitor and adjust based on results

This optimization will make Argos more maintainable, performant, and ready for scale.