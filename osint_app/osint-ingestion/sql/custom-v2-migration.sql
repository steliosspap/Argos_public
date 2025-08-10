-- Custom V2 Migration for Your Existing Schema
-- This works with your current events and conflict_events tables

-- 1. Create articles table to support multi-event extraction
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  published_date TIMESTAMP,
  source_name VARCHAR(255), -- maps to your 'channel' field
  source_url TEXT,
  search_query TEXT,
  search_round INTEGER DEFAULT 1,
  content_hash VARCHAR(64),
  event_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add article_id to your existing events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_index INTEGER; -- 1st, 2nd, 3rd event in article
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_sentence TEXT; -- original text that describes this event
ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50); -- 'pattern', 'llm', 'manual'

-- 3. Add article_id to conflict_events table too
ALTER TABLE conflict_events ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id);
ALTER TABLE conflict_events ADD COLUMN IF NOT EXISTS event_index INTEGER;

-- 4. Create named entities table adapted for your schema
CREATE TABLE IF NOT EXISTS named_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'person', 'location', 'organization', 'weapon', 'group'
  normalized_name VARCHAR(500),
  aliases TEXT[] DEFAULT '{}',
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  mention_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(normalized_name, type)
);

-- 5. Link events to named entities (works with both tables)
CREATE TABLE IF NOT EXISTS event_entities (
  event_id UUID NOT NULL, -- can reference either events or conflict_events
  event_table VARCHAR(50) NOT NULL, -- 'events' or 'conflict_events'
  entity_id UUID REFERENCES named_entities(id),
  role VARCHAR(50), -- 'actor', 'target', 'location', 'mentioned'
  confidence DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (event_id, event_table, entity_id, role)
);

-- 6. Create sources table for media organizations
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL, -- 'ACLED Historical Dataset', 'Reuters', etc
  normalized_name VARCHAR(255) UNIQUE NOT NULL,
  source_type VARCHAR(100), -- 'news', 'dataset', 'social_media', 'government'
  website VARCHAR(255),
  country_of_origin VARCHAR(100),
  bias_score DECIMAL(3,2) DEFAULT 0 CHECK (bias_score >= -1 AND bias_score <= 1),
  reliability_score INTEGER DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create event groups for your existing events
CREATE TABLE IF NOT EXISTS event_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_ids UUID[] NOT NULL,
  event_table VARCHAR(50) NOT NULL DEFAULT 'events', -- which table the events come from
  primary_event_id UUID NOT NULL,
  group_type VARCHAR(50), -- 'duplicate', 'related', 'sequence', 'corroboration'
  similarity_score DECIMAL(3,2),
  time_window_hours INTEGER,
  generated_headline TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Create a unified view of all events from both tables
CREATE OR REPLACE VIEW all_events AS
SELECT 
  id,
  title,
  summary,
  location,
  country,
  region,
  timestamp,
  channel as source_name,
  reliability,
  severity,
  source_url,
  article_id,
  'events' as source_table
FROM events
UNION ALL
SELECT 
  id,
  title,
  description as summary,
  NULL as location, -- conflict_events uses lat/lon instead
  country,
  region,
  timestamp,
  source as source_name,
  reliability,
  severity_level as severity,
  url as source_url,
  article_id,
  'conflict_events' as source_table
FROM conflict_events;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_article_id ON events(article_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_conflict_events_article_id ON conflict_events(article_id);
CREATE INDEX IF NOT EXISTS idx_conflict_events_timestamp ON conflict_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_event_entities_lookup ON event_entities(event_id, event_table);

-- 10. Helper function to extract entities from your events
CREATE OR REPLACE FUNCTION extract_entities_from_event(
  event_id UUID,
  event_table TEXT,
  event_text TEXT
) RETURNS INTEGER AS $$
DECLARE
  entity_count INTEGER := 0;
  entity_matches TEXT[];
  entity_name TEXT;
  entity_type TEXT;
  entity_id UUID;
BEGIN
  -- Extract location entities (countries, cities)
  -- This is a simple example - enhance with better NER
  
  -- Extract organizations/groups from common patterns
  entity_matches := ARRAY(
    SELECT DISTINCT match[1]
    FROM regexp_matches(event_text, '(Police Forces?|Military|Army|Navy|Air Force|Marines|Guard|Militia|Rebels?|Opposition|Government|UN|NATO|EU)', 'gi') AS match
  );
  
  FOREACH entity_name IN ARRAY entity_matches
  LOOP
    -- Check if entity exists
    SELECT id INTO entity_id
    FROM named_entities
    WHERE normalized_name = LOWER(entity_name)
    AND type = 'organization';
    
    IF entity_id IS NULL THEN
      -- Create new entity
      INSERT INTO named_entities (name, normalized_name, type)
      VALUES (entity_name, LOWER(entity_name), 'organization')
      RETURNING id INTO entity_id;
    END IF;
    
    -- Link to event
    INSERT INTO event_entities (event_id, event_table, entity_id, role)
    VALUES (event_id, event_table, entity_id, 'actor')
    ON CONFLICT DO NOTHING;
    
    entity_count := entity_count + 1;
  END LOOP;
  
  RETURN entity_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Populate sources from your existing data
INSERT INTO sources (name, normalized_name, source_type)
SELECT DISTINCT 
  channel as name,
  LOWER(REPLACE(channel, ' ', '_')) as normalized_name,
  CASE 
    WHEN channel LIKE '%Dataset%' THEN 'dataset'
    WHEN channel LIKE '%News%' THEN 'news'
    ELSE 'other'
  END as source_type
FROM events
WHERE channel IS NOT NULL
ON CONFLICT (normalized_name) DO NOTHING;

-- Also from conflict_events
INSERT INTO sources (name, normalized_name, source_type)
SELECT DISTINCT 
  source as name,
  LOWER(REPLACE(source, ' ', '_')) as normalized_name,
  source_type
FROM conflict_events
WHERE source IS NOT NULL
ON CONFLICT (normalized_name) DO NOTHING;

-- 12. Create a sample article from existing events (for testing)
-- This shows how to link multiple events to one article
-- Uncomment to run:
/*
INSERT INTO articles (url, headline, content, published_date, source_name, content_hash)
VALUES (
  'https://example.com/sample-article',
  'Multiple Events in Kenya - Police Operations',
  'This article contains multiple events: weapons seizure, arrests, and community meetings.',
  '2023-09-07',
  'ACLED Historical Dataset',
  MD5('sample-article')::varchar
);
*/

-- 13. Function to migrate existing events to article structure
CREATE OR REPLACE FUNCTION create_articles_from_existing_events()
RETURNS TABLE(created_articles INTEGER, updated_events INTEGER) AS $$
DECLARE
  articles_created INTEGER := 0;
  events_updated INTEGER := 0;
  event_record RECORD;
  new_article_id UUID;
BEGIN
  -- Group events by source_url to create articles
  FOR event_record IN 
    SELECT DISTINCT source_url, channel, MIN(timestamp) as published_date
    FROM events 
    WHERE article_id IS NULL 
    AND source_url IS NOT NULL
    GROUP BY source_url, channel
  LOOP
    -- Create article
    INSERT INTO articles (
      url, 
      source_name, 
      published_date, 
      content,
      content_hash
    ) VALUES (
      event_record.source_url,
      event_record.channel,
      event_record.published_date,
      'Multiple events from ' || event_record.channel,
      MD5(event_record.source_url)::varchar
    )
    ON CONFLICT (url) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO new_article_id;
    
    articles_created := articles_created + 1;
    
    -- Update all events with this URL
    UPDATE events 
    SET article_id = new_article_id
    WHERE source_url = event_record.source_url
    AND article_id IS NULL;
    
    events_updated := events_updated + SQL%ROWCOUNT;
  END LOOP;
  
  RETURN QUERY SELECT articles_created, events_updated;
END;
$$ LANGUAGE plpgsql;

-- Run migration check
SELECT 
  'events' as table_name,
  COUNT(*) as total_records,
  COUNT(article_id) as with_article_id,
  COUNT(DISTINCT source_url) as unique_urls
FROM events
UNION ALL
SELECT 
  'conflict_events' as table_name,
  COUNT(*) as total_records,
  COUNT(article_id) as with_article_id,
  COUNT(DISTINCT url) as unique_urls
FROM conflict_events;