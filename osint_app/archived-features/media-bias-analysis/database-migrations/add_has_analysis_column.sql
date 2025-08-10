-- Add has_analysis column to news table if it doesn't exist
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS has_analysis BOOLEAN DEFAULT FALSE;

-- Add has_analysis column to events table if it doesn't exist
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS has_analysis BOOLEAN DEFAULT FALSE;

-- Update has_analysis for items that have bias analysis
UPDATE news 
SET has_analysis = TRUE 
WHERE bias_score IS NOT NULL 
  OR bias_analysis_id IS NOT NULL;

UPDATE events 
SET has_analysis = TRUE 
WHERE bias_score IS NOT NULL 
  OR bias_analysis_id IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_news_has_analysis ON news(has_analysis);
CREATE INDEX IF NOT EXISTS idx_events_has_analysis ON events(has_analysis);

-- Update the news_with_sources view to include has_analysis
DROP VIEW IF EXISTS news_with_sources CASCADE;
CREATE VIEW news_with_sources AS
SELECT 
    n.*,
    array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL) as sources,
    array_agg(DISTINCT s.url) FILTER (WHERE s.url IS NOT NULL) as source_urls
FROM news n
LEFT JOIN news_sources ns ON n.id = ns.news_id
LEFT JOIN sources s ON ns.source_id = s.id
GROUP BY n.id, n.title, n.url, n.summary, n.date, n.source, n.region, n.tags, 
         n.created_at, n.escalation_score, n.bias_analysis_id, n.fact_check_id, 
         n.bias_score, n.verification_status, n.has_analysis;