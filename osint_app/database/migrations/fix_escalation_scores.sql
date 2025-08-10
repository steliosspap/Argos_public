-- Check current data structure and fix escalation scores

-- 1. First, let's see what columns and data we have
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'events'
  AND column_name IN ('severity', 'reliability', 'escalation_score', 'event_classifier')
ORDER BY column_name;

-- 2. Check sample of events to understand the data
SELECT 
  id,
  title,
  severity,
  reliability,
  escalation_score,
  event_classifier,
  timestamp
FROM events
LIMIT 10;

-- 3. Check severity distribution
SELECT 
  severity,
  COUNT(*) as count
FROM events
GROUP BY severity
ORDER BY severity;

-- 4. Fix escalation scores based on available data
UPDATE events
SET escalation_score = 
  CASE 
    -- First try to use severity if it exists and is not null
    WHEN severity = 'critical' THEN 9
    WHEN severity = 'high' THEN 7
    WHEN severity = 'medium' THEN 5
    WHEN severity = 'low' THEN 3
    
    -- If severity is null or doesn't match, use reliability as a fallback
    WHEN reliability >= 9 THEN 9
    WHEN reliability >= 7 THEN 7
    WHEN reliability >= 5 THEN 5
    WHEN reliability >= 3 THEN 3
    
    -- If we have event_classifier tags, use them
    WHEN 'terror' = ANY(event_classifier) THEN 9
    WHEN 'airstrike' = ANY(event_classifier) THEN 8
    WHEN 'military' = ANY(event_classifier) THEN 7
    WHEN 'civil_unrest' = ANY(event_classifier) THEN 7
    WHEN 'border' = ANY(event_classifier) THEN 6
    WHEN 'cyber' = ANY(event_classifier) THEN 6
    WHEN 'protest' = ANY(event_classifier) THEN 5
    WHEN 'police' = ANY(event_classifier) THEN 4
    WHEN 'diplomatic' = ANY(event_classifier) THEN 3
    
    -- Default to 5 (medium) if we can't determine
    ELSE 5
  END
WHERE escalation_score = 1;  -- Only update the ones that got defaulted to 1

-- 5. Show results after update
SELECT 
  'After Update' as status,
  COUNT(*) as total_events,
  AVG(escalation_score)::numeric(4,2) as avg_score,
  MIN(escalation_score) as min_score,
  MAX(escalation_score) as max_score,
  COUNT(CASE WHEN escalation_score >= 7 THEN 1 END) as high_risk_events,
  COUNT(CASE WHEN escalation_score >= 4 AND escalation_score < 7 THEN 1 END) as medium_risk_events,
  COUNT(CASE WHEN escalation_score < 4 THEN 1 END) as low_risk_events
FROM events;

-- 6. Show distribution by escalation score
SELECT 
  escalation_score,
  COUNT(*) as event_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM events
GROUP BY escalation_score
ORDER BY escalation_score DESC;