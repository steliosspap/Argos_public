-- Migration to add missing columns for intelligent ingestion
-- Run this in Supabase SQL editor

-- Add event_type column if it doesn't exist
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);

-- Add source column if it doesn't exist  
ALTER TABLE events
ADD COLUMN IF NOT EXISTS source VARCHAR(200);

-- Add source_type column if it doesn't exist
ALTER TABLE events
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

-- Add participants array column if it doesn't exist
ALTER TABLE events
ADD COLUMN IF NOT EXISTS participants TEXT[];

-- Add tags array column if it doesn't exist
ALTER TABLE events
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_events_source_type ON events(source_type);
CREATE INDEX IF NOT EXISTS idx_events_participants ON events USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);

-- Add comment to explain columns
COMMENT ON COLUMN events.event_type IS 'Type of conflict: armed_conflict, terrorism, military_operation, civil_unrest, etc.';
COMMENT ON COLUMN events.source IS 'Source website/organization (e.g., reuters.com, bbc.com)';
COMMENT ON COLUMN events.source_type IS 'How data was obtained: intelligent_search, rss_ingestion, historical_dataset, etc.';
COMMENT ON COLUMN events.participants IS 'Array of actors/parties involved in the conflict';
COMMENT ON COLUMN events.tags IS 'Additional metadata tags for filtering and categorization';