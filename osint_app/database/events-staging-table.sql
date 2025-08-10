-- Create staging table for events without coordinates
-- This table allows partial geographic information for debugging and later processing
CREATE TABLE IF NOT EXISTS events_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    -- Allow nullable location for events without coordinates
    location GEOGRAPHY(POINT),
    -- Geographic information can be partial
    country TEXT,
    region TEXT,
    city TEXT,
    -- Store raw location text for debugging
    location_text TEXT,
    -- Store extraction details
    extraction_method TEXT,
    extraction_confidence FLOAT,
    skip_reason TEXT,
    -- Rest of the fields same as events table
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    channel TEXT NOT NULL,
    reliability INTEGER CHECK (reliability >= 0 AND reliability <= 10),
    event_classifier TEXT[] DEFAULT '{}',
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    source_url TEXT,
    -- Processing status
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed', 'skipped')),
    processing_notes TEXT,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_events_staging_timestamp ON events_staging(timestamp DESC);
CREATE INDEX idx_events_staging_country ON events_staging(country);
CREATE INDEX idx_events_staging_region ON events_staging(region);
CREATE INDEX idx_events_staging_processing_status ON events_staging(processing_status);
CREATE INDEX idx_events_staging_skip_reason ON events_staging(skip_reason);
CREATE INDEX idx_events_staging_created_at ON events_staging(created_at DESC);

-- Create GIN index for full text search
CREATE INDEX idx_events_staging_search ON events_staging USING GIN(to_tsvector('english', title || ' ' || summary));

-- Enable Row Level Security
ALTER TABLE events_staging ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Staging events are viewable by everyone" ON events_staging
    FOR SELECT USING (true);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_events_staging_updated_at BEFORE UPDATE ON events_staging
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View to analyze skipped events
CREATE OR REPLACE VIEW events_staging_analysis AS
SELECT 
    skip_reason,
    COUNT(*) as count,
    ARRAY_AGG(DISTINCT country) FILTER (WHERE country IS NOT NULL) as countries,
    ARRAY_AGG(DISTINCT region) FILTER (WHERE region IS NOT NULL) as regions,
    AVG(extraction_confidence) as avg_confidence,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM events_staging
WHERE processing_status = 'skipped'
GROUP BY skip_reason
ORDER BY count DESC;

-- Function to migrate events from staging to main table when coordinates are available
CREATE OR REPLACE FUNCTION migrate_staging_events_with_coords() RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
BEGIN
    -- Insert events that now have coordinates into main events table
    INSERT INTO events (
        title, summary, location, country, region, timestamp, 
        channel, reliability, event_classifier, severity, source_url
    )
    SELECT 
        title, 
        summary, 
        location, 
        COALESCE(country, 'Unknown'), 
        COALESCE(region, 'Unknown'), 
        timestamp,
        channel, 
        reliability, 
        event_classifier, 
        severity, 
        source_url
    FROM events_staging
    WHERE location IS NOT NULL 
    AND processing_status = 'pending';
    
    -- Get count of migrated rows
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    
    -- Update status of migrated events
    UPDATE events_staging 
    SET processing_status = 'processed',
        processing_notes = 'Migrated to events table',
        updated_at = NOW()
    WHERE location IS NOT NULL 
    AND processing_status = 'pending';
    
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;