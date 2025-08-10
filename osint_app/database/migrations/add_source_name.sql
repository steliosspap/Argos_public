-- Add source_name column to events table for better source tracking
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS source_name VARCHAR(255);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_events_source_name ON events(source_name);

-- Update existing events to extract source name from URLs
UPDATE events
SET source_name = 
  CASE 
    WHEN source_urls IS NOT NULL AND array_length(source_urls, 1) > 0 THEN
      regexp_replace(
        regexp_replace(
          source_urls[1],
          '^https?://(www\.)?',
          ''
        ),
        '/.*$',
        ''
      )
    ELSE 'Unknown'
  END
WHERE source_name IS NULL;