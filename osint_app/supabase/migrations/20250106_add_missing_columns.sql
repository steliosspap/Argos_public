-- Add content_hash column to events table for deduplication
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Add city column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS city VARCHAR(255);

-- Create index for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_events_content_hash ON events(content_hash);

-- Add composite index for better deduplication queries
CREATE INDEX IF NOT EXISTS idx_events_dedup ON events(content_hash, country, DATE(timestamp));

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_channel ON events(channel);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);

-- Update column comments
COMMENT ON COLUMN events.content_hash IS 'SHA256 hash for deduplication based on title, country, city/region, and date';
COMMENT ON COLUMN events.city IS 'City name extracted from event location data';