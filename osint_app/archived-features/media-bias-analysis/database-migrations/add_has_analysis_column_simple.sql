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

-- Check if news_with_sources view exists and update it
DO $$
BEGIN
    -- Only update the view if it exists
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'news_with_sources') THEN
        -- Get the current view definition and recreate it with the new column
        -- For now, we'll skip this as it depends on tables that might not exist
        NULL;
    END IF;
END $$;