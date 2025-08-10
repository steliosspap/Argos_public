# Argos Database Migration Plan

Based on actual codebase analysis, here's a practical migration plan that focuses on real improvements without breaking existing functionality.

## Priority 1: Immediate Optimizations (No Code Changes Required)

### 1.1 Add Missing Indexes (Do Today)
```sql
-- These will immediately improve performance without any code changes

-- Events table (most queried)
CREATE INDEX CONCURRENTLY idx_events_timestamp_desc ON events(timestamp DESC);
CREATE INDEX CONCURRENTLY idx_events_country_region ON events(country, region);
CREATE INDEX CONCURRENTLY idx_events_severity_esc ON events(severity, escalation_score DESC);

-- News table (high insert/query volume)
CREATE INDEX CONCURRENTLY idx_news_published_desc ON news(published_at DESC);
CREATE INDEX CONCURRENTLY idx_news_processed ON news(processed) WHERE NOT processed;
CREATE INDEX CONCURRENTLY idx_news_content_hash ON news(content_hash);

-- Conflicts table (for escalation updates)
CREATE INDEX CONCURRENTLY idx_conflicts_active_escalation ON conflicts(status, escalation_score DESC) 
WHERE status = 'active';

-- Arms deals (for API queries)
CREATE INDEX CONCURRENTLY idx_arms_deals_date ON arms_deals(date DESC);
CREATE INDEX CONCURRENTLY idx_arms_deals_country ON arms_deals(supplier_country, recipient_country);
```

### 1.2 Clean Unused Tables (Save Storage)
```sql
-- These tables are created but never used according to codebase analysis

-- Backup first (just in case)
CREATE SCHEMA IF NOT EXISTS archive;

-- Move unused tables to archive
ALTER TABLE IF EXISTS analytics_events SET SCHEMA archive;
ALTER TABLE IF EXISTS pipeline_runs SET SCHEMA archive;
ALTER TABLE IF EXISTS api_usage SET SCHEMA archive;
ALTER TABLE IF EXISTS user_activity_costs SET SCHEMA archive;
ALTER TABLE IF EXISTS cost_metrics SET SCHEMA archive;
ALTER TABLE IF EXISTS api_cost_tracking SET SCHEMA archive;
ALTER TABLE IF EXISTS model_usage_tracking SET SCHEMA archive;
ALTER TABLE IF EXISTS rate_limit_tracking SET SCHEMA archive;
ALTER TABLE IF EXISTS user_activity_logs SET SCHEMA archive;

-- After 30 days with no issues, drop the archive schema
```

## Priority 2: Consolidate Duplicate Tables (Requires Code Updates)

### 2.1 Merge conflict_events into events

**Current situation:**
- `events` table: Used by main pipeline
- `conflict_events` table: Used by syncConflictEvents.js only
- 90% overlapping fields

**Migration approach:**
```sql
-- Step 1: Add missing fields to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS casualties_reported INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS participants TEXT[],
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified';

-- Step 2: Migrate data from conflict_events
INSERT INTO events (
    title, summary, timestamp, country, region,
    severity, event_type, casualties_reported,
    participants, source_url, created_at
)
SELECT 
    title, description as summary, event_date as timestamp,
    country, region, severity_level as severity,
    event_type, casualties_reported, participants,
    url as source_url, created_at
FROM conflict_events
ON CONFLICT (content_hash) DO NOTHING;

-- Step 3: Update syncConflictEvents.js to use events table
-- Step 4: Drop conflict_events after verification
```

### 2.2 Optimize news_sources relationship

**Current situation:**
- Complex JOIN queries for multi-source news
- Only 1-5 sources per article typically

**Simple fix:**
```sql
-- Add sources array to news table
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS all_sources JSONB DEFAULT '[]'::jsonb;

-- Populate from news_sources
UPDATE news n
SET all_sources = (
    SELECT jsonb_agg(jsonb_build_object(
        'name', ns.source_name,
        'url', ns.source_url,
        'published_at', ns.published_at
    ))
    FROM news_sources ns
    WHERE ns.news_id = n.id
);

-- Update the view
CREATE OR REPLACE VIEW news_with_sources AS
SELECT 
    n.*,
    n.source as primary_source_name,
    jsonb_array_length(COALESCE(n.all_sources, '[]'::jsonb)) + 1 as source_count,
    COALESCE(n.all_sources, '[]'::jsonb) as additional_sources
FROM news n;
```

## Priority 3: Fix the Broken Pipeline Connection

### 3.1 Add Automatic Escalation Updates

**The Core Issue:** Events are created but don't trigger conflict updates

**Solution 1: Database Trigger (Recommended)**
```sql
-- Create a lightweight trigger that marks conflicts for update
CREATE OR REPLACE FUNCTION mark_conflict_for_escalation_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark conflicts in the same region for update
    UPDATE conflicts
    SET escalation_last_calculated = NOW() - INTERVAL '1 hour'
    WHERE country = NEW.country 
      AND region = NEW.region
      AND status = 'active';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_event_insert_mark_escalation
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION mark_conflict_for_escalation_update();

-- Create a function to process pending updates
CREATE OR REPLACE FUNCTION process_pending_escalation_updates()
RETURNS void AS $$
DECLARE
    v_conflict RECORD;
BEGIN
    -- Process conflicts that need updating
    FOR v_conflict IN 
        SELECT * FROM conflicts
        WHERE status = 'active'
        AND (escalation_last_calculated IS NULL 
             OR escalation_last_calculated < NOW() - INTERVAL '5 minutes')
        LIMIT 10  -- Process in batches
    LOOP
        PERFORM update_single_conflict_escalation(v_conflict.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Solution 2: Add to Application Code**
```javascript
// In syncEvents.js, after inserting events:
if (results.inserted > 0) {
    await updateConflictZoneEscalation(supabase);
}

// In ingest-news.js, after processing:
await updateConflictZoneEscalation(supabase);
```

## Priority 4: Add Missing Core Features

### 4.1 Data Sources Management
```sql
-- Track RSS feeds and their reliability
CREATE TABLE data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    url VARCHAR(2048) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'rss',
    
    -- Performance metrics
    last_fetch_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    avg_articles_per_fetch DECIMAL(10,2),
    avg_events_per_article DECIMAL(5,2),
    
    -- Configuration
    active BOOLEAN DEFAULT true,
    fetch_interval INTEGER DEFAULT 900, -- seconds
    categories TEXT[],
    regions TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing hardcoded sources
INSERT INTO data_sources (name, url, type, categories) VALUES
('BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'rss', ARRAY['news']),
('Reuters', 'https://www.reiters.com/rssfeed/world', 'rss', ARRAY['news']),
-- ... etc
```

### 4.2 Event-Conflict Relationships
```sql
-- Add foreign key to link events to conflicts
ALTER TABLE events 
ADD COLUMN conflict_id UUID REFERENCES conflicts(id);

-- Create index for fast lookups
CREATE INDEX idx_events_conflict_id ON events(conflict_id) 
WHERE conflict_id IS NOT NULL;

-- Backfill relationships based on country/region
UPDATE events e
SET conflict_id = c.id
FROM conflicts c
WHERE e.country = c.country
  AND e.region = c.region
  AND c.status = 'active'
  AND e.conflict_id IS NULL;
```

## Implementation Timeline

### Week 1: Zero-Impact Optimizations
- [ ] Add all missing indexes (1 hour)
- [ ] Archive unused tables (30 minutes)
- [ ] Deploy monitoring to measure improvements

### Week 2: Pipeline Fixes
- [ ] Implement escalation trigger/code updates
- [ ] Test with production data copy
- [ ] Deploy with monitoring

### Week 3: Table Consolidation
- [ ] Merge conflict_events → events
- [ ] Optimize news_sources → news.all_sources
- [ ] Update affected code

### Week 4: New Features
- [ ] Add data_sources table
- [ ] Implement event-conflict relationships
- [ ] Documentation and cleanup

## Rollback Plan

Each change can be rolled back independently:

```sql
-- Rollback indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_name;

-- Rollback archived tables
ALTER TABLE archive.table_name SET SCHEMA public;

-- Rollback column additions
ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;

-- Rollback triggers
DROP TRIGGER IF EXISTS trigger_name ON table_name;
```

## Success Metrics

Monitor these metrics before and after each change:

1. **Query Performance**
   - Events listing page load time
   - Map data query time
   - News ingestion processing time

2. **Data Quality**
   - Escalation scores updating correctly
   - No duplicate events
   - Proper event-conflict correlation

3. **Storage Efficiency**
   - Database size reduction
   - Index bloat metrics
   - Table statistics

## Next Steps

1. **Get approval** for the migration plan
2. **Create test environment** with production data copy
3. **Start with Priority 1** (zero-impact changes)
4. **Monitor metrics** after each change
5. **Proceed to next priority** only after validation

This pragmatic approach focuses on real improvements based on actual usage patterns, ensuring minimal disruption while maximizing benefits.