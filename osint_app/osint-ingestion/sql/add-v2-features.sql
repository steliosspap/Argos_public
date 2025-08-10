-- Add V2 features to existing events table
-- This is a safer approach that enhances your existing schema

-- 1. First, let's see what columns you already have
-- Run this to check your current events table structure:
-- \d events

-- 2. Add new columns to support multi-event extraction (if they don't exist)
ALTER TABLE events ADD COLUMN IF NOT EXISTS article_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_sentence TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2) DEFAULT 0.8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_index INTEGER; -- which event in the article (1st, 2nd, etc)

-- 3. Create articles table to link multiple events to one article
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  published_date TIMESTAMP,
  source_name VARCHAR(255),
  source_url TEXT,
  search_query TEXT,
  search_round INTEGER DEFAULT 1,
  content_hash VARCHAR(64),
  event_count INTEGER DEFAULT 0, -- how many events extracted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create a simple named entities table
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'person', 'location', 'organization', 'weapon'
  normalized_name VARCHAR(500),
  first_seen_event_id UUID REFERENCES events(id),
  last_seen_event_id UUID REFERENCES events(id),
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(normalized_name, type)
);

-- 5. Link events to entities
CREATE TABLE IF NOT EXISTS event_entities (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  role VARCHAR(50), -- 'actor', 'target', 'location', 'mentioned'
  PRIMARY KEY (event_id, entity_id, role)
);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_article_id ON events(article_id);
CREATE INDEX IF NOT EXISTS idx_entities_normalized_name ON entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

-- 7. Create a view to see events with their articles
CREATE OR REPLACE VIEW events_with_articles AS
SELECT 
  e.*,
  a.url as article_url,
  a.headline as article_headline,
  a.content as article_content,
  a.event_count as total_events_in_article
FROM events e
LEFT JOIN articles a ON e.article_id = a.id;

-- 8. Create a function to link existing events to articles
CREATE OR REPLACE FUNCTION create_articles_from_events()
RETURNS void AS $$
DECLARE
  event_record RECORD;
  article_id UUID;
BEGIN
  -- Loop through events that don't have article_id
  FOR event_record IN 
    SELECT DISTINCT source_url, source_name, estimated_time
    FROM events 
    WHERE article_id IS NULL AND source_url IS NOT NULL
  LOOP
    -- Create article
    INSERT INTO articles (url, source_name, published_date, content, content_hash)
    VALUES (
      event_record.source_url,
      event_record.source_name,
      event_record.estimated_time,
      'Content not available - migrated from events',
      MD5(event_record.source_url)::varchar
    )
    ON CONFLICT (url) DO NOTHING
    RETURNING id INTO article_id;
    
    -- Update events with this URL
    UPDATE events 
    SET article_id = article_id
    WHERE source_url = event_record.source_url;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. Run the migration function (uncomment when ready)
-- SELECT create_articles_from_events();

-- 10. Check your migration results
-- SELECT COUNT(*) as total_events FROM events;
-- SELECT COUNT(*) as events_with_articles FROM events WHERE article_id IS NOT NULL;
-- SELECT COUNT(*) as total_articles FROM articles;