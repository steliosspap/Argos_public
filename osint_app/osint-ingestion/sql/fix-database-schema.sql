-- Fix Database Schema Issues
-- Run this in Supabase SQL Editor to fix all column and table name issues

-- 1. Check if 'sources' table exists (the migration uses 'sources', not 'news_sources')
DO $$
BEGIN
    -- If 'news_sources' exists but 'sources' doesn't, rename it
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'news_sources' AND schemaname = 'public') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') THEN
        ALTER TABLE news_sources RENAME TO sources;
    END IF;
END $$;

-- 2. Create sources table if it doesn't exist
CREATE TABLE IF NOT EXISTS sources (
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

-- 3. Add missing columns to events table
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

-- 4. Create articles_raw table if needed (without foreign key first)
CREATE TABLE IF NOT EXISTS articles_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  published_date TIMESTAMP,
  first_detected TIMESTAMP DEFAULT NOW(),
  last_modified TIMESTAMP DEFAULT NOW(),
  source_id UUID,  -- No foreign key constraint yet
  author_ids UUID[] DEFAULT '{}',
  search_round INTEGER,
  search_query TEXT,
  content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4b. Add foreign key constraint to articles_raw if sources table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') 
       AND EXISTS (SELECT FROM pg_tables WHERE tablename = 'articles_raw' AND schemaname = 'public')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE constraint_name = 'articles_raw_source_id_fkey' 
           AND table_name = 'articles_raw'
       ) THEN
        ALTER TABLE articles_raw ADD CONSTRAINT articles_raw_source_id_fkey 
        FOREIGN KEY (source_id) REFERENCES sources(id);
    END IF;
END $$;

-- 5. Add foreign key constraint if not exists (only if articles_raw table exists with id column)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'articles_raw' 
        AND column_name = 'id'
        AND table_schema = 'public'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_events_article' 
        AND table_name = 'events'
    ) THEN
        ALTER TABLE events ADD CONSTRAINT fk_events_article 
        FOREIGN KEY (article_id) REFERENCES articles_raw(id);
    END IF;
END $$;

-- 6. Insert baseline sources
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

-- 7. Update the IngestionService code references
-- Note: You'll need to update the code to use 'sources' instead of 'news_sources'

-- 8. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- 9. Verify the changes
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('events', 'sources', 'articles_raw')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;