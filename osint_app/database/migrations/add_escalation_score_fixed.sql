-- Migration: Add escalation_score column to events table (Fixed)
-- This handles the case where constraints might already exist

-- First, check if the column already exists
DO $$ 
BEGIN
  -- Add escalation_score to events table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'escalation_score'
  ) THEN
    ALTER TABLE events 
    ADD COLUMN escalation_score INTEGER;
    
    -- Add constraint with a unique name for events table
    ALTER TABLE events
    ADD CONSTRAINT events_escalation_score_check 
    CHECK (escalation_score >= 1 AND escalation_score <= 10);
  END IF;
END $$;

-- Set default values based on existing severity levels
UPDATE events 
SET escalation_score = CASE 
    WHEN severity = 'critical' THEN 9
    WHEN severity = 'high' THEN 7
    WHEN severity = 'medium' THEN 5
    WHEN severity = 'low' THEN 3
    ELSE 5
END
WHERE escalation_score IS NULL;

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_events_escalation_score ON events(escalation_score);

-- Create composite index for filtering if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_events_escalation_timestamp ON events(escalation_score, timestamp DESC);

-- Add comment explaining the column
COMMENT ON COLUMN events.escalation_score IS 'Event severity/escalation level (1-10): 1-3=low risk, 4-6=medium risk, 7-8=high risk, 9-10=critical';

-- Show results
SELECT 
  'events' as table_name,
  COUNT(*) as total_events,
  COUNT(escalation_score) as events_with_score,
  AVG(escalation_score) as avg_score,
  MIN(escalation_score) as min_score,
  MAX(escalation_score) as max_score
FROM events;