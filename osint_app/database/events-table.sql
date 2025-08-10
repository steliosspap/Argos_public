-- Create events table for OSINT data
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    location GEOGRAPHY(POINT) NOT NULL,
    country TEXT NOT NULL,
    region TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    channel TEXT NOT NULL,
    reliability INTEGER CHECK (reliability >= 0 AND reliability <= 10),
    event_classifier TEXT[] DEFAULT '{}',
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_country ON events(country);
CREATE INDEX idx_events_region ON events(region);
CREATE INDEX idx_events_severity ON events(severity);
CREATE INDEX idx_events_channel ON events(channel);
CREATE INDEX idx_events_location ON events USING GIST(location);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Create GIN index for full text search
CREATE INDEX idx_events_search ON events USING GIN(to_tsvector('english', title || ' ' || summary));

-- Create GIN index for array search on event_classifier
CREATE INDEX idx_events_classifier ON events USING GIN(event_classifier);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Events are viewable by everyone" ON events
    FOR SELECT USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create view for easier querying with lat/lng
CREATE OR REPLACE VIEW events_with_coords AS
SELECT 
    id,
    title,
    summary,
    ST_Y(location::geometry) as latitude,
    ST_X(location::geometry) as longitude,
    country,
    region,
    timestamp,
    channel,
    reliability,
    event_classifier,
    severity,
    source_url,
    created_at,
    updated_at
FROM events;

-- Sample insert statement (for testing)
-- INSERT INTO events (title, summary, location, country, region, timestamp, channel, reliability, event_classifier, severity, source_url)
-- VALUES (
--     'Explosion reported in Damascus suburb',
--     'Multiple sources report explosion in Jaramana district, casualties unknown',
--     ST_GeogFromText('POINT(36.3462 33.4862)'),
--     'Syria',
--     'Damascus',
--     '2024-01-15 14:30:00+00',
--     'Telegram',
--     7,
--     ARRAY['explosion', 'urban_warfare'],
--     'high',
--     'https://example.com/source'
-- );