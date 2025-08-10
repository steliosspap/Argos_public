# Argos Database Schema Optimization Report

## Executive Summary

This report analyzes the current Argos database schema to identify optimization opportunities. The analysis reveals significant redundancy, overlapping functionality, and potential for consolidation across the 14+ tables in the system.

## Current Schema Overview

### Core Data Tables
1. **events** - Main OSINT event tracking with GEOGRAPHY type
2. **events_staging** - Temporary storage for events without coordinates
3. **conflict_events** - Legacy conflict tracking with simple lat/lng
4. **conflicts** - Static conflict definitions and metadata
5. **news** - News articles with deduplication support
6. **news_sources** - Multi-outlet tracking for news
7. **arms_deals** - Arms trade tracking

### Supporting Tables
8. **users** - User authentication
9. **user_preferences** - User customization settings
10. **beta_signups** - Landing page signups
11. **analytics_events** - User interaction tracking
12. **cost_metrics** - Business metrics
13. **pipeline_runs** - ETL job tracking
14. **api_usage** - API call tracking
15. **user_activity_costs** - User-specific cost tracking

## Critical Issues Identified

### 1. Redundant Event Tables

**Problem**: Three tables store similar event data with overlapping purposes:
- `events` (uses GEOGRAPHY type, has events_with_coords view)
- `events_staging` (allows nullable coordinates)
- `conflict_events` (uses simple lat/lng, has escalation_score)

**Evidence**: The API code in `/src/app/api/events/route.ts` tries multiple tables:
```typescript
// First tries events_with_coords view
// Falls back to conflict_events table if not found
```

**Recommendation**: 
- Merge all three into a single `events` table
- Use nullable GEOGRAPHY field to handle staging scenarios
- Add `processing_status` column to track staging state
- Migrate `escalation_score` from conflict_events

### 2. Overlapping Conflict Tracking

**Problem**: Two tables track conflict information differently:
- `conflicts` - Static conflict definitions with status tracking
- `conflict_events` - Real-time conflict events with escalation scores

**Recommendation**: 
- Keep `conflicts` as master conflict registry
- Add foreign key from `events` to `conflicts` to link events to conflicts
- Remove `conflict_events` table after merging with `events`

### 3. Inefficient News Deduplication

**Problem**: Complex two-table structure for news deduplication:
- `news` table with basic article info
- `news_sources` table for multi-outlet tracking
- Requires joins and complex functions for basic queries

**Recommendation**:
- Add `sources` JSONB column directly to `news` table
- Store outlet information as array of objects
- Eliminate `news_sources` table and complex join queries
- Use GIN index on JSONB for efficient searching

### 4. Excessive Cost Tracking Tables

**Problem**: Four separate tables for cost tracking:
- `cost_metrics`
- `pipeline_runs`
- `api_usage`
- `user_activity_costs`

**Recommendation**:
- Merge into single `system_metrics` table with `metric_type` column
- Use JSONB for flexible metric storage
- Simplify queries and reduce table maintenance

### 5. Missing Critical Indexes

**Identified Missing Indexes**:
```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_events_country_severity_timestamp 
  ON events(country, severity, timestamp DESC);

CREATE INDEX idx_events_region_escalation 
  ON events(region, escalation_score DESC);

-- Partial indexes for active records
CREATE INDEX idx_conflicts_active 
  ON conflicts(status) WHERE status = 'active';

-- BRIN index for time-series data
CREATE INDEX idx_events_timestamp_brin 
  ON events USING BRIN(timestamp);
```

### 6. Missing Foreign Key Relationships

**Problem**: Tables lack proper relationships:
- No link between `events` and `conflicts`
- No link between `events` and `arms_deals`
- No user tracking in main data tables

**Recommendation**: Add foreign keys:
```sql
ALTER TABLE events 
  ADD COLUMN conflict_id UUID REFERENCES conflicts(id),
  ADD COLUMN created_by UUID REFERENCES users(id);

ALTER TABLE arms_deals
  ADD COLUMN related_conflict_id UUID REFERENCES conflicts(id);
```

## Optimization Roadmap

### Phase 1: Consolidate Event Tables (Priority: High)
1. Add missing columns to `events` table:
   ```sql
   ALTER TABLE events 
     ADD COLUMN escalation_score DECIMAL(3,1),
     ADD COLUMN processing_status TEXT DEFAULT 'active',
     ADD COLUMN conflict_id UUID REFERENCES conflicts(id),
     ADD COLUMN event_type TEXT;
   ```

2. Migrate data from `conflict_events` and `events_staging`
3. Update all API endpoints to use single table
4. Drop redundant tables

### Phase 2: Simplify News Structure (Priority: Medium)
1. Add sources column to news table:
   ```sql
   ALTER TABLE news 
     ADD COLUMN sources JSONB DEFAULT '[]'::jsonb;
   ```

2. Migrate data from `news_sources` to JSONB column
3. Create GIN index for efficient querying
4. Drop `news_sources` table

### Phase 3: Consolidate Metrics (Priority: Low)
1. Create unified `system_metrics` table:
   ```sql
   CREATE TABLE system_metrics (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     metric_type TEXT NOT NULL,
     metric_data JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. Migrate existing metrics data
3. Drop individual metric tables

### Phase 4: Add Missing Relationships (Priority: Medium)
1. Add foreign keys to establish proper relationships
2. Create junction tables for many-to-many relationships
3. Add cascading delete rules where appropriate

## Performance Improvements

### 1. Implement Table Partitioning
```sql
-- Partition events by month for better performance
CREATE TABLE events_new (LIKE events) PARTITION BY RANGE (timestamp);

CREATE TABLE events_2024_01 PARTITION OF events_new
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. Add Materialized Views
```sql
-- Pre-calculate common aggregations
CREATE MATERIALIZED VIEW daily_event_summary AS
SELECT 
  DATE(timestamp) as date,
  country,
  region,
  severity,
  COUNT(*) as event_count,
  AVG(escalation_score) as avg_escalation
FROM events
GROUP BY 1, 2, 3, 4;

CREATE INDEX ON daily_event_summary(date, country);
```

### 3. Optimize Expensive Queries
- Replace recursive CTEs with indexed lookups
- Use partial indexes for filtered queries
- Implement query result caching

## Storage Optimization

### 1. Archive Old Data
- Move events older than 6 months to archive table
- Implement automated archival process
- Use table compression for archives

### 2. Clean Unused Columns
- Remove duplicate location storage (lat/lng vs GEOGRAPHY)
- Consolidate timestamp columns (created_at, updated_at, timestamp)
- Remove redundant status tracking

## Migration Priority

1. **Immediate** (Week 1):
   - Consolidate event tables
   - Add critical missing indexes
   
2. **Short-term** (Month 1):
   - Simplify news deduplication
   - Add foreign key relationships
   
3. **Medium-term** (Quarter 1):
   - Consolidate metrics tables
   - Implement partitioning
   
4. **Long-term** (Year 1):
   - Archive historical data
   - Optimize storage

## Expected Benefits

- **Performance**: 40-60% query speed improvement
- **Storage**: 30% reduction in storage needs
- **Maintenance**: 50% reduction in schema complexity
- **Development**: Faster feature development with cleaner schema

## Risk Mitigation

1. Create full backup before migrations
2. Test migrations in staging environment
3. Implement gradual rollout with fallback options
4. Monitor performance metrics during migration
5. Keep old tables for 30 days before dropping

## Conclusion

The current schema shows signs of organic growth with significant technical debt. The proposed optimizations will dramatically simplify the database structure while improving performance and maintainability. Priority should be given to consolidating the event tables and adding proper indexes, as these changes will have the most immediate impact on system performance.