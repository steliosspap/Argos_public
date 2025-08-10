-- Quick Fix for OSINT Pipeline Errors
-- This addresses the immediate issues without creating new tables

-- 1. First, check what tables we have
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sources', 'news_sources', 'events', 'articles_raw');

-- 2. If you have 'news_sources' but the code expects 'sources', create an alias or rename
-- Option A: Rename (recommended)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'news_sources' AND schemaname = 'public') 
       AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') THEN
        ALTER TABLE news_sources RENAME TO sources;
    END IF;
END $$;

-- 3. Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS attribution_source VARCHAR(100);

-- 4. If sources table doesn't exist at all, create it
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

-- 5. Verify the fix worked
SELECT 
  'sources table exists' as check_item,
  EXISTS (SELECT FROM pg_tables WHERE tablename = 'sources' AND schemaname = 'public') as status
UNION ALL
SELECT 
  'events.attribution_source exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'attribution_source') as status;