-- Fix Remaining Schema Issues
-- Run this in Supabase SQL Editor

-- 1. Add casualties column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS casualties JSONB DEFAULT '{"killed": 0, "wounded": 0}';

-- 2. Force PostgREST to refresh its schema cache
-- This is crucial for Supabase to recognize new columns
NOTIFY pgrst, 'reload schema';

-- 3. Alternative method to refresh schema (if above doesn't work)
-- You may need to wait a moment or refresh the Supabase dashboard
SELECT pg_notify('pgrst', 'reload schema');

-- 4. Verify the columns exist
SELECT 
  'events.casualties exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'casualties') as status
UNION ALL
SELECT 
  'sources.bias_source exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sources' AND column_name = 'bias_source') as status
UNION ALL
SELECT 
  'events.attribution_source exists' as check_item,
  EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'attribution_source') as status;

-- 5. Show all columns in both tables for verification
SELECT 'Events table columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'events' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Sources table columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'sources' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. If schema cache is still not updating, try this workaround:
-- Create a dummy function to force schema reload
CREATE OR REPLACE FUNCTION force_schema_reload() RETURNS void AS $$
BEGIN
  -- This forces PostgREST to reload
  RAISE NOTICE 'Forcing schema reload';
END;
$$ LANGUAGE plpgsql;

-- Then drop it
DROP FUNCTION IF EXISTS force_schema_reload();

-- 7. As a last resort, you might need to:
-- a) Go to Supabase Dashboard
-- b) Navigate to Settings > API
-- c) Click "Reload schema" button
-- OR
-- d) Restart the Supabase project (in project settings)