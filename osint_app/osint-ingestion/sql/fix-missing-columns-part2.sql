-- Part 2: Add more columns to events table

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