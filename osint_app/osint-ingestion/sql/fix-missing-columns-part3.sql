-- Part 3: Fix news_sources table

ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS bias_score DECIMAL(3,2) DEFAULT 0.5;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS reliability_score DECIMAL(3,2) DEFAULT 0.7;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS focus_regions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS political_leaning VARCHAR(50);
ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS verification_notes TEXT;