-- Add column to track if news has been processed for events
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS processed_for_events BOOLEAN DEFAULT NULL;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_news_processed_for_events 
ON news(processed_for_events) 
WHERE processed_for_events IS NULL;

-- Comment on the column
COMMENT ON COLUMN news.processed_for_events IS 'Indicates if this news article has been processed and synced to the events table for map display';