-- Safe Fix for OSINT Pipeline - Run these one at a time to debug any issues

-- Step 1: Check current state
SELECT 'Checking existing tables...' as status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sources', 'news_sources', 'events', 'articles_raw', 'articles')
ORDER BY table_name;

-- Step 2: Handle sources/news_sources table
SELECT 'Fixing sources table...' as status;
DO $$
BEGIN
    -- If 'news_sources' exists but 'sources' doesn't, rename it
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'news_sources' AND schemaname = 'public') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') THEN
        ALTER TABLE news_sources RENAME TO sources;
        RAISE NOTICE 'Renamed news_sources to sources';
    ELSIF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') THEN
        -- Create sources table if it doesn't exist
        CREATE TABLE sources (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          normalized_name VARCHAR(255) UNIQUE NOT NULL,
          website VARCHAR(255),
          country_of_origin VARCHAR(100),
          bias_score DECIMAL(3,2) CHECK (bias_score >= -1 AND bias_score <= 1),
          reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100),
          bias_source VARCHAR(100),
          last_bias_update TIMESTAMP,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        RAISE NOTICE 'Created sources table';
    ELSE
        RAISE NOTICE 'Sources table already exists';
    END IF;
END $$;

-- Step 3: Add missing columns to events table
SELECT 'Adding columns to events table...' as status;
ALTER TABLE events ADD COLUMN IF NOT EXISTS attribution_source VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS article_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS temporal_expression VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_interval VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS binary_flags JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_category VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_subcategory VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS attribution_text TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_sentence TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2);

-- Step 4: Verify results
SELECT 'Verification...' as status;
SELECT 
  'sources table exists' as check_item,
  EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') as status
UNION ALL
SELECT 
  'events.attribution_source exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'attribution_source') as status
UNION ALL
SELECT 
  'events.article_id exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'article_id') as status;

-- Step 5: Show column info for debugging
SELECT 'Events table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'events' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 6: Insert baseline sources (optional - only if needed)
-- Uncomment the following if you want to add baseline sources
/*
INSERT INTO sources (name, normalized_name, bias_score, reliability_score, bias_source) VALUES
  ('United Nations News', 'un_news', 0.0, 90, 'manual'),
  ('NATO News', 'nato_news', 0.3, 85, 'manual'),
  ('OCHA ReliefWeb', 'reliefweb', 0.0, 85, 'manual'),
  ('ACLED', 'acled', 0.0, 95, 'manual'),
  ('Uppsala Conflict Data Program', 'ucdp', 0.0, 95, 'manual'),
  ('CFR Global Conflict Tracker', 'cfr_tracker', 0.1, 85, 'manual'),
  ('Reuters', 'reuters', 0.0, 85, 'manual'),
  ('Associated Press', 'ap', 0.0, 85, 'manual'),
  ('BBC News', 'bbc', -0.1, 80, 'manual'),
  ('Al Jazeera', 'aljazeera', -0.2, 75, 'manual')
ON CONFLICT (normalized_name) DO UPDATE SET
  bias_score = EXCLUDED.bias_score,
  reliability_score = EXCLUDED.reliability_score,
  bias_source = EXCLUDED.bias_source,
  updated_at = NOW();
*/