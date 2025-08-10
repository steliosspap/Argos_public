-- Align Database Schema with Code Expectations
-- This fixes the mismatch between code expectations and actual database schema

-- 1. Fix sources table - add 'id' column if it doesn't exist
DO $$
BEGIN
    -- Check if 'id' column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sources' AND column_name = 'id'
    ) THEN
        -- If source_id exists, rename it to id
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sources' AND column_name = 'source_id'
        ) THEN
            ALTER TABLE sources RENAME COLUMN source_id TO id;
            RAISE NOTICE 'Renamed source_id to id';
        ELSE
            -- Add id column
            ALTER TABLE sources ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
            RAISE NOTICE 'Added id column';
        END IF;
    END IF;
END $$;

-- 2. Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS enhanced_headline TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS escalation_score INTEGER CHECK (escalation_score >= 0 AND escalation_score <= 10);
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0.8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_multi_source BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS actor VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_classifier TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS participants TEXT[] DEFAULT '{}';

-- 3. Add columns that might be referenced by the code
ALTER TABLE events ADD COLUMN IF NOT EXISTS estimated_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS temporal_info JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS linked_events UUID[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50);

-- 4. Ensure events has necessary location columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- 5. Force multiple schema reloads
DO $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..10 LOOP
        NOTIFY pgrst, 'reload schema';
        PERFORM pg_sleep(0.2);
    END LOOP;
END $$;

-- 6. Verify all columns exist
SELECT 'Sources table check:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sources' 
  AND column_name IN ('id', 'name', 'normalized_name', 'bias_source', 'bias_score', 'reliability_score')
ORDER BY column_name;

SELECT 'Events table check:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events' 
  AND column_name IN ('id', 'title', 'enhanced_headline', 'casualties', 'attribution_source', 'escalation_score')
ORDER BY column_name;