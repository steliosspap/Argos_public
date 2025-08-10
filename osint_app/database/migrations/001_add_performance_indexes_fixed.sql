-- Performance Optimization: Add Missing Indexes
-- Fixed version for Supabase SQL Editor (no CONCURRENTLY)
-- This will lock tables briefly but works in transaction

-- Events table indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_events_timestamp_desc 
ON events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_country_region 
ON events(country, region);

CREATE INDEX IF NOT EXISTS idx_events_severity_escalation 
ON events(severity, escalation_score DESC);

CREATE INDEX IF NOT EXISTS idx_events_location_gist 
ON events USING GIST(location);

-- News table indexes (high insert/query volume)
CREATE INDEX IF NOT EXISTS idx_news_published_desc 
ON news(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_unprocessed 
ON news(processed_at) 
WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_news_content_hash 
ON news(content_hash);

CREATE INDEX IF NOT EXISTS idx_news_country_region 
ON news(country, region) 
WHERE country IS NOT NULL;

-- Conflicts table indexes (for escalation updates)
CREATE INDEX IF NOT EXISTS idx_conflicts_active_escalation 
ON conflicts(status, escalation_score DESC) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_conflicts_country_region 
ON conflicts(country, region);

-- Arms deals indexes (for API queries)
CREATE INDEX IF NOT EXISTS idx_arms_deals_date 
ON arms_deals(date DESC);

CREATE INDEX IF NOT EXISTS idx_arms_deals_countries 
ON arms_deals(seller_country, buyer_country);

-- Verify indexes were created
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;