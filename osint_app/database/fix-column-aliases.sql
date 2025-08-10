-- =============================================================================
-- COLUMN ALIAS FIX FOR ARGOS DATABASE
-- =============================================================================
-- Fixes frontend query errors by adding backward-compatible column aliases
-- conflict_events.timestamp (alias for event_date)
-- news.date (alias for published_at)
-- 
-- Usage: Copy and paste this entire script into Supabase SQL Editor
-- =============================================================================

-- Add timestamp alias to conflict_events table
ALTER TABLE conflict_events 
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP 
GENERATED ALWAYS AS (event_date) STORED;

-- Add date alias to news table  
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS date TIMESTAMP 
GENERATED ALWAYS AS (published_at::TIMESTAMP) STORED;

-- Add performance indexes for the new alias columns
CREATE INDEX IF NOT EXISTS idx_conflict_events_timestamp 
ON conflict_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_news_date 
ON news (date DESC);

-- Add comments to document the aliases
COMMENT ON COLUMN conflict_events.timestamp IS 'Generated alias for event_date - provides backward compatibility for frontend queries';
COMMENT ON COLUMN news.date IS 'Generated alias for published_at - provides backward compatibility for frontend queries';

-- Verify the fixes work with test queries
SELECT 'conflict_events timestamp alias' AS test, COUNT(*) AS row_count 
FROM conflict_events 
WHERE timestamp IS NOT NULL
UNION ALL
SELECT 'news date alias' AS test, COUNT(*) AS row_count 
FROM news 
WHERE date IS NOT NULL;