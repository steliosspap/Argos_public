-- Argos V2 Migration Script
-- This adds new tables and modifies existing ones for multi-event architecture

-- 1. First, let's check what tables already exist
-- Run this query to see existing tables:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- 2. Add new columns to existing events table if needed
ALTER TABLE events ADD COLUMN IF NOT EXISTS article_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS temporal_expression VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_interval VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS binary_flags JSONB DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_category VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_subcategory VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS attribution_source VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS attribution_text TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_sentence TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2);

-- 3. Create sources table if not exists
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

-- 4. Create authors table if not exists
CREATE TABLE IF NOT EXISTS authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) UNIQUE NOT NULL,
  source_id UUID REFERENCES sources(id),
  article_count INTEGER DEFAULT 0,
  inferred_bias_score DECIMAL(3,2),
  bias_confidence DECIMAL(3,2),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create articles_raw table if not exists
CREATE TABLE IF NOT EXISTS articles_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  published_date TIMESTAMP,
  first_detected TIMESTAMP DEFAULT NOW(),
  last_modified TIMESTAMP DEFAULT NOW(),
  source_id UUID REFERENCES sources(id),
  author_ids UUID[] DEFAULT '{}',
  search_round INTEGER,
  search_query TEXT,
  content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. Add foreign key to events table for article_id
ALTER TABLE events 
  ADD CONSTRAINT fk_events_article 
  FOREIGN KEY (article_id) 
  REFERENCES articles_raw(id);

-- 7. Create named_entities table if not exists
CREATE TABLE IF NOT EXISTS named_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  normalized_name VARCHAR(500) NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  mention_count INTEGER DEFAULT 1,
  source_article_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(normalized_name, type)
);

-- 8. Create junction table for event-entity relationships
CREATE TABLE IF NOT EXISTS event_named_entities (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  named_entity_id UUID REFERENCES named_entities(id) ON DELETE CASCADE,
  role VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (event_id, named_entity_id, role)
);

-- 9. Create event_groups table if not exists
CREATE TABLE IF NOT EXISTS event_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_ids UUID[] NOT NULL,
  primary_event_id UUID REFERENCES events(id),
  group_confidence DECIMAL(3,2),
  corroboration_count INTEGER,
  source_diversity_score DECIMAL(3,2),
  generated_headline TEXT,
  bias_distribution JSONB,
  average_reliability DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Create search_queries audit table
CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  query_type VARCHAR(50), -- 'broad', 'targeted', 'llm_generated'
  subject VARCHAR(255),
  modifier VARCHAR(255),
  round_number INTEGER,
  articles_found INTEGER DEFAULT 0,
  events_extracted INTEGER DEFAULT 0,
  executed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_article_id ON events(article_id);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor);
CREATE INDEX IF NOT EXISTS idx_events_estimated_date ON events(estimated_date);
CREATE INDEX IF NOT EXISTS idx_events_event_category ON events(event_category);
CREATE INDEX IF NOT EXISTS idx_named_entities_normalized ON named_entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_named_entities_type ON named_entities(type);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles_raw(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_date ON articles_raw(published_date);
CREATE INDEX IF NOT EXISTS idx_articles_url_hash ON articles_raw(content_hash);
CREATE INDEX IF NOT EXISTS idx_event_named_entities_event ON event_named_entities(event_id);
CREATE INDEX IF NOT EXISTS idx_event_named_entities_entity ON event_named_entities(named_entity_id);

-- 12. Create a view for easy event querying with all relationships
CREATE OR REPLACE VIEW event_details AS
SELECT 
  e.*,
  a.url as article_url,
  a.headline as article_headline,
  a.published_date as article_published_date,
  s.name as source_name,
  s.bias_score as source_bias,
  s.reliability_score as source_reliability,
  array_agg(DISTINCT ne.name) FILTER (WHERE ene.role = 'actor') as actor_entities,
  array_agg(DISTINCT ne.name) FILTER (WHERE ene.role = 'location') as location_entities,
  array_agg(DISTINCT ne.name) FILTER (WHERE ene.role = 'mentioned') as mentioned_entities
FROM events e
LEFT JOIN articles_raw a ON e.article_id = a.id
LEFT JOIN sources s ON a.source_id = s.id
LEFT JOIN event_named_entities ene ON e.id = ene.event_id
LEFT JOIN named_entities ne ON ene.named_entity_id = ne.id
GROUP BY e.id, a.url, a.headline, a.published_date, s.name, s.bias_score, s.reliability_score;

-- 13. Populate sources table with known media organizations
INSERT INTO sources (name, normalized_name, bias_score, reliability_score, bias_source) VALUES
  ('Reuters', 'reuters', 0.0, 100, 'manual'),
  ('Associated Press', 'associated_press', 0.0, 100, 'manual'),
  ('BBC', 'bbc', -0.1, 95, 'manual'),
  ('Al Jazeera', 'al_jazeera', -0.4, 85, 'manual'),
  ('Fox News', 'fox_news', 0.5, 65, 'manual'),
  ('CNN', 'cnn', -0.3, 80, 'manual'),
  ('The Guardian', 'the_guardian', -0.4, 85, 'manual'),
  ('The New York Times', 'the_new_york_times', -0.3, 90, 'manual'),
  ('The Wall Street Journal', 'the_wall_street_journal', 0.2, 90, 'manual')
ON CONFLICT (normalized_name) DO NOTHING;

-- 14. Helper function to normalize source names
CREATE OR REPLACE FUNCTION normalize_source_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(input_name, '[^a-z0-9]+', '_', 'g'));
END;
$$ LANGUAGE plpgsql;

-- 15. Trigger to update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_authors_updated_at BEFORE UPDATE ON authors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles_raw
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_named_entities_updated_at BEFORE UPDATE ON named_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration complete!
-- To verify, run:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;