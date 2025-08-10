-- Performance Optimization: Add Missing Indexes
-- These indexes will immediately improve query performance without any code changes
-- Run this in Supabase SQL Editor

-- Events table indexes (most queried table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp_desc 
ON events(timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_country_region 
ON events(country, region);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_severity_escalation 
ON events(severity, escalation_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_location_gist 
ON events USING GIST(location);

-- News table indexes (high insert/query volume)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_news_published_desc 
ON news(published_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_news_processed 
ON news(processed) 
WHERE NOT processed;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_news_content_hash 
ON news(content_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_news_country_region 
ON news(country, region) 
WHERE country IS NOT NULL;

-- Conflicts table indexes (for escalation updates)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conflicts_active_escalation 
ON conflicts(status, escalation_score DESC) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conflicts_country_region 
ON conflicts(country, region);

-- Arms deals indexes (for API queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_arms_deals_date 
ON arms_deals(date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_arms_deals_countries 
ON arms_deals(supplier_country, recipient_country);

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('events', 'news', 'conflicts', 'arms_deals')
ORDER BY tablename, indexname;