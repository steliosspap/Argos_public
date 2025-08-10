-- Final fixes for remaining issues

-- 1. Check if sources table has 'id' or 'source_id'
SELECT 'Checking sources table columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sources' 
  AND column_name IN ('id', 'source_id')
ORDER BY column_name;

-- 2. If source_id exists but not id, rename it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sources' AND column_name = 'source_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sources' AND column_name = 'id'
    ) THEN
        ALTER TABLE sources RENAME COLUMN source_id TO id;
        RAISE NOTICE 'Renamed source_id to id';
    END IF;
END $$;

-- 3. Fix the reliability column in events table
-- Check current data type
SELECT 'Current reliability column type:' as info;
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'reliability';

-- Change reliability from integer to decimal if needed
DO $$
BEGIN
    -- Check if reliability is integer type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'reliability'
        AND data_type = 'integer'
    ) THEN
        -- Change to decimal
        ALTER TABLE events ALTER COLUMN reliability TYPE DECIMAL(3,2);
        RAISE NOTICE 'Changed reliability to DECIMAL(3,2)';
    END IF;
END $$;

-- 4. Make region column nullable (it's causing not-null constraint errors)
ALTER TABLE events ALTER COLUMN region DROP NOT NULL;

-- 5. Add any other missing columns that might be needed
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0.8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_multi_source BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;

-- 6. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 7. Verify the changes
SELECT 'Final verification:' as info;
SELECT 
    'sources.id exists' as check_item,
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sources' AND column_name = 'id') as status
UNION ALL
SELECT 
    'events.reliability is DECIMAL' as check_item,
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'reliability' AND data_type = 'numeric') as status
UNION ALL
SELECT 
    'events.region is nullable' as check_item,
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'region' AND is_nullable = 'YES') as status;