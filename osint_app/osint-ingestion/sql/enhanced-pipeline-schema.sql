-- Enhanced Pipeline Database Schema
-- This schema extends the existing tables to support the comprehensive conflict monitoring system

-- 1. Entity Database Tables
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'person', 'organization', 'location', 'weapon', 'group'
  subtype VARCHAR(100), -- more specific categorization
  aliases TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(normalized_name, type)
);

CREATE INDEX idx_entities_name ON entities(normalized_name);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_aliases ON entities USING GIN(aliases);

-- 2. Media Organizations (extends sources)
ALTER TABLE sources ADD COLUMN IF NOT EXISTS organization_type VARCHAR(50) DEFAULT 'news';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS ownership_structure JSONB;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS political_affiliation VARCHAR(100);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS fact_check_record JSONB DEFAULT '{}';
ALTER TABLE sources ADD COLUMN IF NOT EXISTS average_factuality DECIMAL(3,2) DEFAULT 0.5;

-- 3. Authors/Journalists tracking
CREATE TABLE IF NOT EXISTS authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  source_affiliations JSONB DEFAULT '[]', -- array of {source_id, role, period}
  bias_metrics JSONB DEFAULT '{}', -- {political_lean: -1 to 1, credibility: 0-1}
  expertise_areas TEXT[] DEFAULT '{}',
  social_media_handles JSONB DEFAULT '{}',
  article_count INTEGER DEFAULT 0,
  accuracy_score DECIMAL(3,2) DEFAULT 0.5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_authors_name ON authors(normalized_name);

-- 4. Conflict Subjects (for query generation)
CREATE TABLE IF NOT EXISTS conflict_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'country', 'region', 'organization', 'conflict_zone'
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1-10 scale
  search_modifiers TEXT[] DEFAULT '{}', -- specific terms to combine with
  related_entities UUID[] DEFAULT '{}', -- links to entities table
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Enhanced Articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES authors(id);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temporal_precision VARCHAR(50); -- 'exact', 'day', 'week', 'month'
ALTER TABLE articles ADD COLUMN IF NOT EXISTS temporal_confidence DECIMAL(3,2);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_opinion BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_analysis BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS extracted_claims JSONB DEFAULT '[]';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS extracted_entities UUID[] DEFAULT '{}';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS corroboration_status VARCHAR(50); -- 'unverified', 'corroborated', 'disputed', 'debunked'

-- 6. Fact Claims table
CREATE TABLE IF NOT EXISTS fact_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_text TEXT NOT NULL,
  claim_type VARCHAR(50), -- 'casualty', 'event', 'statement', 'action'
  source_article_id UUID REFERENCES articles(id),
  event_id UUID REFERENCES events(id),
  entities_involved UUID[] DEFAULT '{}',
  temporal_reference JSONB, -- {date, precision, confidence}
  location_reference JSONB, -- {location_id, precision}
  corroboration_count INTEGER DEFAULT 1,
  dispute_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  verification_status VARCHAR(50) DEFAULT 'unverified',
  supporting_articles UUID[] DEFAULT '{}',
  disputing_articles UUID[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fact_claims_event ON fact_claims(event_id);
CREATE INDEX idx_fact_claims_confidence ON fact_claims(confidence_score);

-- 7. Event-Article Relationships (many-to-many)
CREATE TABLE IF NOT EXISTS event_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  article_id UUID REFERENCES articles(id),
  relevance_score DECIMAL(3,2) DEFAULT 0.5,
  is_primary_source BOOLEAN DEFAULT false,
  extraction_confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, article_id)
);

CREATE INDEX idx_event_articles_event ON event_articles(event_id);
CREATE INDEX idx_event_articles_article ON event_articles(article_id);

-- 8. Search Queries Audit (enhance existing)
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS generation_method VARCHAR(50); -- 'subject_modifier', 'targeted_research', 'llm_generated'
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES events(id);
ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS effectiveness_score DECIMAL(3,2);

-- 9. Cross-Reference Network
CREATE TABLE IF NOT EXISTS event_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_a_id UUID REFERENCES events(id),
  event_b_id UUID REFERENCES events(id),
  relationship_type VARCHAR(50), -- 'causes', 'caused_by', 'related', 'contradicts'
  confidence DECIMAL(3,2) DEFAULT 0.5,
  evidence JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_a_id, event_b_id, relationship_type)
);

-- 10. Temporal Confidence for events
ALTER TABLE events ADD COLUMN IF NOT EXISTS temporal_precision VARCHAR(50) DEFAULT 'hour';
ALTER TABLE events ADD COLUMN IF NOT EXISTS temporal_confidence DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE events ADD COLUMN IF NOT EXISTS earliest_possible TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS latest_possible TIMESTAMP;

-- 11. Enhanced Event Groups
ALTER TABLE event_groups ADD COLUMN IF NOT EXISTS fact_claim_ids UUID[] DEFAULT '{}';
ALTER TABLE event_groups ADD COLUMN IF NOT EXISTS total_articles INTEGER DEFAULT 0;
ALTER TABLE event_groups ADD COLUMN IF NOT EXISTS factual_articles INTEGER DEFAULT 0;
ALTER TABLE event_groups ADD COLUMN IF NOT EXISTS opinion_articles INTEGER DEFAULT 0;
ALTER TABLE event_groups ADD COLUMN IF NOT EXISTS cross_corroboration_score DECIMAL(3,2);

-- Views for easier querying
CREATE OR REPLACE VIEW event_article_counts AS
SELECT 
  e.id as event_id,
  e.title,
  COUNT(DISTINCT ea.article_id) as total_articles,
  COUNT(DISTINCT CASE WHEN a.is_opinion = false THEN ea.article_id END) as factual_articles,
  AVG(ea.relevance_score) as avg_relevance
FROM events e
LEFT JOIN event_articles ea ON e.id = ea.event_id
LEFT JOIN articles a ON ea.article_id = a.id
GROUP BY e.id, e.title;

-- Force schema reload
NOTIFY pgrst, 'reload schema';