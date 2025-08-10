-- Final fixes for remaining issues (handling dependent views)

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

-- 3. Handle the reliability column type change
DO $$
DECLARE
    view_def TEXT;
BEGIN
    -- Check if reliability is integer type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'reliability'
        AND data_type = 'integer'
    ) THEN
        -- Save the view definition if it exists
        SELECT pg_get_viewdef('event_latest_versions', true) INTO view_def;
        
        -- Drop the view if it exists
        DROP VIEW IF EXISTS event_latest_versions CASCADE;
        
        -- Change column type
        ALTER TABLE events ALTER COLUMN reliability TYPE DECIMAL(3,2) USING reliability::DECIMAL(3,2);
        RAISE NOTICE 'Changed reliability to DECIMAL(3,2)';
        
        -- Recreate the view if we had saved its definition
        IF view_def IS NOT NULL THEN
            EXECUTE 'CREATE VIEW event_latest_versions AS ' || view_def;
            RAISE NOTICE 'Recreated event_latest_versions view';
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If the view doesn't exist, just change the column
        IF SQLSTATE = '42P01' THEN
            ALTER TABLE events ALTER COLUMN reliability TYPE DECIMAL(3,2) USING reliability::DECIMAL(3,2);
            RAISE NOTICE 'Changed reliability to DECIMAL(3,2) (no view to handle)';
        ELSE
            RAISE;
        END IF;
END $$;

-- 4. Make region column nullable (it's causing not-null constraint errors)
ALTER TABLE events ALTER COLUMN region DROP NOT NULL;

-- 5. Add any other missing columns that might be needed
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0.8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_multi_source BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;

-- 6. Alternative approach: Instead of changing column type, we can handle it in the model
-- Create a trigger to automatically convert decimal to integer if needed
CREATE OR REPLACE FUNCTION convert_reliability()
RETURNS TRIGGER AS $$
BEGIN
    -- If reliability is between 0 and 1, multiply by 10 to get integer 0-10
    IF NEW.reliability IS NOT NULL AND NEW.reliability <= 1 THEN
        NEW.reliability = ROUND(NEW.reliability * 10);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if reliability is still integer
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'reliability'
        AND data_type = 'integer'
    ) THEN
        DROP TRIGGER IF EXISTS convert_reliability_trigger ON events;
        CREATE TRIGGER convert_reliability_trigger
        BEFORE INSERT OR UPDATE ON events
        FOR EACH ROW EXECUTE FUNCTION convert_reliability();
        RAISE NOTICE 'Created reliability conversion trigger';
    END IF;
END $$;

-- 7. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 8. Verify the changes
SELECT 'Final verification:' as info;
SELECT 
    'sources.id exists' as check_item,
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sources' AND column_name = 'id') as status
UNION ALL
SELECT 
    'events.reliability type' as check_item,
    (SELECT data_type FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'reliability') as status
UNION ALL
SELECT 
    'events.region is nullable' as check_item,
    EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'region' AND is_nullable = 'YES') as status;