-- Final fix for remaining column issues
-- Run this in Supabase SQL Editor

-- 1. Fix the typo: bias_source -> bias_score
UPDATE news_sources SET bias_score = 0.5 WHERE bias_score IS NULL;

-- 2. Add article_id column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS article_id UUID;

-- 3. Create articles table if it doesn't exist
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  published_date TIMESTAMP,
  source_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Add foreign key constraint (optional)
-- ALTER TABLE events ADD CONSTRAINT fk_article 
-- FOREIGN KEY (article_id) REFERENCES articles(id);

-- 5. Refresh the schema cache
-- This query forces Supabase to refresh its cache
SELECT COUNT(*) FROM events WHERE article_id IS NULL;