-- Phase 2 Intelligence Features Migration
-- Adds bias detection, entity linking, and enhanced analytics columns

-- Add bias detection columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS bias JSONB DEFAULT '{}';

-- Add entity linking array
ALTER TABLE events ADD COLUMN IF NOT EXISTS entity_links JSONB DEFAULT '[]';

-- Add timeline summary
ALTER TABLE events ADD COLUMN IF NOT EXISTS timeline_summary TEXT;

-- Add sentiment and analytics columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS sentiment_trend VARCHAR(20);
ALTER TABLE events ADD COLUMN IF NOT EXISTS impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS verification_sources JSONB DEFAULT '[]';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_bias_alignment ON events ((bias->>'politicalAlignment'));
CREATE INDEX IF NOT EXISTS idx_events_sentiment_trend ON events(sentiment_trend);
CREATE INDEX IF NOT EXISTS idx_events_impact_score ON events(impact_score);

-- Create source bias lookup table
CREATE TABLE IF NOT EXISTS source_bias_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(255) UNIQUE NOT NULL,
    bias_rating VARCHAR(50), -- far-left, left, center-left, center, center-right, right, far-right
    reliability_score FLOAT CHECK (reliability_score >= 0 AND reliability_score <= 1),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Insert some initial source bias ratings
INSERT INTO source_bias_ratings (source_name, bias_rating, reliability_score, metadata) VALUES
    ('Reuters', 'center', 0.95, '{"type": "news_agency"}'),
    ('AP', 'center', 0.95, '{"type": "news_agency"}'),
    ('BBC', 'center-left', 0.90, '{"type": "broadcaster"}'),
    ('CNN', 'left', 0.80, '{"type": "broadcaster"}'),
    ('Fox News', 'right', 0.75, '{"type": "broadcaster"}'),
    ('RT', 'far-right', 0.40, '{"type": "state_media", "country": "Russia"}'),
    ('Al Jazeera', 'center-left', 0.85, '{"type": "broadcaster", "region": "Middle East"}'),
    ('The Guardian', 'left', 0.85, '{"type": "newspaper"}'),
    ('Wall Street Journal', 'center-right', 0.90, '{"type": "newspaper"}'),
    ('NPR', 'center-left', 0.90, '{"type": "public_media"}')
ON CONFLICT (source_name) DO UPDATE SET
    bias_rating = EXCLUDED.bias_rating,
    reliability_score = EXCLUDED.reliability_score,
    last_updated = NOW();

-- Create entity links lookup table for caching
CREATE TABLE IF NOT EXISTS entity_wikidata_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_text VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50), -- person, organization, location, etc.
    wikidata_qid VARCHAR(20),
    label VARCHAR(255),
    description TEXT,
    confidence FLOAT DEFAULT 0.0,
    last_verified TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(entity_text, entity_type)
);

-- Create timeline summaries table
CREATE TABLE IF NOT EXISTS timeline_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID,
    event_ids UUID[],
    summary TEXT NOT NULL,
    key_points JSONB DEFAULT '[]',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    model_used VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- Add index for cluster lookups
CREATE INDEX IF NOT EXISTS idx_timeline_summaries_cluster ON timeline_summaries(cluster_id);

-- Create analytics materialized view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS conflict_zone_analytics AS
SELECT 
    country,
    COUNT(*) as event_count,
    AVG(escalation_score) as avg_escalation,
    AVG(impact_score) as avg_impact,
    SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_events,
    SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_severity_events,
    MAX(timestamp) as last_event,
    DATE_TRUNC('day', MIN(timestamp)) as first_event_day
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY country;

-- Create index for analytics view
CREATE UNIQUE INDEX IF NOT EXISTS idx_conflict_zone_analytics_country ON conflict_zone_analytics(country);

-- Refresh function for analytics
CREATE OR REPLACE FUNCTION refresh_conflict_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY conflict_zone_analytics;
END;
$$ LANGUAGE plpgsql;