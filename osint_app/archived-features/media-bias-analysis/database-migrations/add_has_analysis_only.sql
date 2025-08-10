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