-- Check current schema structure
-- Run this to see what columns actually exist

-- 1. Check events table columns
SELECT 'EVENTS TABLE COLUMNS:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if casualties column exists in events
SELECT 
  'events.casualties exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'casualties') as status
UNION ALL
SELECT 
  'events.attribution_source exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'attribution_source') as status;

-- 3. Check sources table for required columns
SELECT 'SOURCES TABLE - Missing columns check:' as info;
SELECT 
  'sources.bias_source exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sources' AND column_name = 'bias_source') as status
UNION ALL
SELECT 
  'sources.normalized_name exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sources' AND column_name = 'normalized_name') as status;