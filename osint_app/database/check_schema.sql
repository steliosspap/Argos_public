-- Check current schema for escalation_score columns and constraints

-- 1. Check which tables have escalation_score column
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE column_name = 'escalation_score'
  AND table_schema = 'public'
ORDER BY table_name;

-- 2. Check all constraints related to escalation_score
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_name LIKE '%escalation%'
   OR cc.check_clause LIKE '%escalation%'
ORDER BY tc.table_name, tc.constraint_name;

-- 3. Check specifically the events table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Count events by severity to understand current data
SELECT 
  severity,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM events
GROUP BY severity
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
    ELSE 5
  END;