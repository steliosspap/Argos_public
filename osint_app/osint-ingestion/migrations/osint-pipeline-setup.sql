-- OSINT Pipeline Database Setup
-- Run this migration to ensure all required tables and functions exist

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Ensure sources table has all required fields
ALTER TABLE sources 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for source metadata
CREATE INDEX IF NOT EXISTS idx_sources_metadata ON sources USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_sources_normalized_name ON sources(normalized_name);

-- Ensure events table has all required fields
ALTER TABLE events
ADD COLUMN IF NOT EXISTS enhanced_headline TEXT,
ADD COLUMN IF NOT EXISTS confidence_interval JSONB,
ADD COLUMN IF NOT EXISTS admin_level_1 TEXT,
ADD COLUMN IF NOT EXISTS admin_level_2 TEXT,
ADD COLUMN IF NOT EXISTS casualties JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS escalation_score INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS processing_version TEXT DEFAULT '1.0';

-- Create indexes for event queries
CREATE INDEX IF NOT EXISTS idx_events_country ON events(country);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING gist(location);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at 
BEFORE UPDATE ON sources 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at 
BEFORE UPDATE ON events 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create event statistics view
CREATE OR REPLACE VIEW event_statistics AS
SELECT 
    DATE(timestamp) as event_date,
    country,
    event_type,
    severity,
    COUNT(*) as event_count,
    SUM((casualties->>'killed')::INTEGER) as total_killed,
    SUM((casualties->>'wounded')::INTEGER) as total_wounded,
    AVG(reliability) as avg_reliability,
    AVG(escalation_score) as avg_escalation
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp), country, event_type, severity;

-- Create source performance view
CREATE OR REPLACE VIEW source_performance AS
SELECT 
    s.id,
    s.name,
    s.reliability_score,
    s.bias_score,
    COUNT(DISTINCT a.id) as article_count,
    COUNT(DISTINCT e.id) as event_count,
    AVG(e.reliability) as avg_event_reliability,
    s.metadata->>'lastSuccessfulFetch' as last_fetch,
    s.metadata->>'healthScore' as health_score
FROM sources s
LEFT JOIN articles_raw a ON a.source_id = s.id
LEFT JOIN events e ON e.article_id = a.id
GROUP BY s.id, s.name, s.reliability_score, s.bias_score, s.metadata;

-- Create helper function for location search
CREATE OR REPLACE FUNCTION search_events_by_location(
    search_location TEXT,
    radius_km NUMERIC DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    timestamp TIMESTAMPTZ,
    location_name TEXT,
    distance_km NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH target_location AS (
        SELECT location 
        FROM events 
        WHERE location_name ILIKE '%' || search_location || '%' 
        LIMIT 1
    )
    SELECT 
        e.id,
        e.title,
        e.timestamp,
        e.location_name,
        ST_Distance(e.location::geography, t.location::geography) / 1000 as distance_km
    FROM events e, target_location t
    WHERE ST_DWithin(
        e.location::geography, 
        t.location::geography, 
        radius_km * 1000
    )
    ORDER BY e.timestamp DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Create function for event deduplication check
CREATE OR REPLACE FUNCTION find_similar_events(
    check_location TEXT,
    check_timestamp TIMESTAMPTZ,
    time_window_hours INTEGER DEFAULT 6
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    timestamp TIMESTAMPTZ,
    location_name TEXT,
    similarity_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.timestamp,
        e.location_name,
        CASE 
            WHEN e.location_name ILIKE '%' || check_location || '%' THEN 0.8
            ELSE 0.5
        END + 
        CASE 
            WHEN ABS(EXTRACT(EPOCH FROM (e.timestamp - check_timestamp))/3600) < 1 THEN 0.2
            WHEN ABS(EXTRACT(EPOCH FROM (e.timestamp - check_timestamp))/3600) < 3 THEN 0.1
            ELSE 0
        END as similarity_score
    FROM events e
    WHERE 
        e.timestamp BETWEEN check_timestamp - INTERVAL '1 hour' * time_window_hours 
        AND check_timestamp + INTERVAL '1 hour' * time_window_hours
        AND (
            e.location_name ILIKE '%' || check_location || '%'
            OR e.country = ANY(
                SELECT country FROM events 
                WHERE location_name ILIKE '%' || check_location || '%' 
                LIMIT 1
            )
        )
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for API access
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_raw ENABLE ROW LEVEL SECURITY;

-- Public read access for events
CREATE POLICY "Events are viewable by everyone" 
ON events FOR SELECT 
USING (true);

-- Authenticated write access for events
CREATE POLICY "Events are insertable by authenticated users" 
ON events FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Public read access for sources
CREATE POLICY "Sources are viewable by everyone" 
ON sources FOR SELECT 
USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_raw_created_at ON articles_raw(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_reliability ON events(reliability DESC);
CREATE INDEX IF NOT EXISTS idx_events_escalation ON events(escalation_score DESC);

-- Maintenance: Update statistics
ANALYZE events;
ANALYZE sources;
ANALYZE articles_raw;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'OSINT Pipeline database setup completed successfully';
END
$$;