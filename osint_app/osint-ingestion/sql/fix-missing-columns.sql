-- Fix missing columns in the database
-- Run this to add all required columns for the pipeline

-- 1. Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_level_1 VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS admin_level_2 VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS actors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS targets JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS civilian_impact TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS military_units JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weapons_used JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS infrastructure_damage TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS displacement_count INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS aid_disruption BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS territory_control TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS strategic_value TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS international_response TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS media_sources JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified';
ALTER TABLE events ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]'::jsonb;

-- 2. Add missing columns to news_sources table
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS bias_score DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS reliability_score DECIMAL(3,2) DEFAULT 0.7;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS focus_regions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS political_leaning VARCHAR(50);
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_admin_level_1 ON events(admin_level_1);
CREATE INDEX IF NOT EXISTS idx_events_admin_level_2 ON events(admin_level_2);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_confidence_score ON events(confidence_score);
CREATE INDEX IF NOT EXISTS idx_news_sources_bias_score ON news_sources(bias_score);
CREATE INDEX IF NOT EXISTS idx_news_sources_reliability_score ON news_sources(reliability_score);

-- 4. Update any null values with defaults
UPDATE events SET admin_level_1 = country WHERE admin_level_1 IS NULL AND country IS NOT NULL;
UPDATE events SET confidence_score = 0.8 WHERE confidence_score IS NULL;
UPDATE events SET source_count = 1 WHERE source_count IS NULL;

-- 5. Refresh Supabase schema cache (important!)
-- Note: You may need to restart your Supabase instance or wait a few seconds for the schema cache to update

COMMENT ON COLUMN events.admin_level_1 IS 'State/Province/Region name';
COMMENT ON COLUMN events.admin_level_2 IS 'City/District/County name';
COMMENT ON COLUMN events.confidence_score IS 'AI confidence in event extraction (0-1)';
COMMENT ON COLUMN news_sources.bias_score IS 'Media bias rating (0=left, 0.5=center, 1=right)';
COMMENT ON COLUMN news_sources.reliability_score IS 'Source reliability rating (0-1)';