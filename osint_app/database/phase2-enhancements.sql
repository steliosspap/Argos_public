-- Phase 2 News Ingestion Enhancements
-- Add new columns for escalation scoring and geotagging

-- Add escalation score column (0-10 scale based on conflict intensity keywords)
ALTER TABLE news ADD COLUMN IF NOT EXISTS escalation_score INTEGER DEFAULT 0;

-- Add country and region columns for better geographic classification
ALTER TABLE news ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS region TEXT;

-- Add summary column for future LLM-generated summaries
ALTER TABLE news ADD COLUMN IF NOT EXISTS summary TEXT;

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_news_escalation_score ON news(escalation_score);
CREATE INDEX IF NOT EXISTS idx_news_country ON news(country);
CREATE INDEX IF NOT EXISTS idx_news_region ON news(region);

-- Add comments for documentation
COMMENT ON COLUMN news.escalation_score IS 'Conflict intensity score: 0-10+ based on keywords like missile, bombing, ceasefire';
COMMENT ON COLUMN news.country IS 'Primary country mentioned in article (auto-detected)';
COMMENT ON COLUMN news.region IS 'Geographic region: Middle East, Europe, Africa, Asia, Americas';
COMMENT ON COLUMN news.summary IS 'AI-generated summary (for future Phase 3 implementation)';

-- Update RLS policies to include new columns (if needed)
-- The existing policies should automatically cover new columns