-- Add escalation_score column to conflicts table for real-time conflict map
-- Run this script in Supabase SQL Editor

-- Add escalation_score column
ALTER TABLE conflicts 
ADD COLUMN IF NOT EXISTS escalation_score INTEGER;

-- Add check constraint to ensure escalation_score is between 0 and 10
ALTER TABLE conflicts 
ADD CONSTRAINT check_escalation_score_range 
CHECK (escalation_score >= 0 AND escalation_score <= 10);

-- Update existing conflicts with realistic escalation scores based on status
UPDATE conflicts 
SET escalation_score = CASE 
  WHEN status = 'active' THEN 
    CASE 
      WHEN name ILIKE '%gaza%' OR name ILIKE '%ukraine%' THEN 9
      WHEN name ILIKE '%syria%' OR name ILIKE '%yemen%' THEN 7
      WHEN name ILIKE '%sudan%' OR name ILIKE '%myanmar%' THEN 6
      ELSE 5
    END
  WHEN status = 'ceasefire' THEN 3
  WHEN status = 'resolved' THEN 1
  ELSE 2
END
WHERE escalation_score IS NULL;

-- Update updated_at for all conflicts to ensure fresh timestamps
UPDATE conflicts 
SET updated_at = NOW() - INTERVAL '1 hour' * (RANDOM() * 24);

-- Create index on escalation_score for better query performance
CREATE INDEX IF NOT EXISTS idx_conflicts_escalation_score ON conflicts(escalation_score);

-- Verify the update
SELECT 
  name,
  country,
  status,
  escalation_score,
  updated_at
FROM conflicts 
ORDER BY escalation_score DESC, updated_at DESC;