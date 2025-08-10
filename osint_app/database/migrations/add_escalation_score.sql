-- Migration: Add escalation_score column to events table
-- This fixes the critical issue where frontend is using reliability as a fallback

-- Add the escalation_score column
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS escalation_score INTEGER 
CHECK (escalation_score >= 1 AND escalation_score <= 10);

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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_events_escalation_score ON events(escalation_score);

-- Create composite index for filtering
CREATE INDEX IF NOT EXISTS idx_events_escalation_timestamp ON events(escalation_score, timestamp DESC);

-- Add comment explaining the column
COMMENT ON COLUMN events.escalation_score IS 'Event severity/escalation level (1-10): 1-3=low risk, 4-6=medium risk, 7-8=high risk, 9-10=critical';