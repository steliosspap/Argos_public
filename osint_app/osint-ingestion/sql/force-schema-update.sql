-- Force Schema Update and Fix Sources Table

-- 1. First, let's check what's actually in the sources table
SELECT 'Current sources table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sources' AND table_schema = 'public'
AND column_name IN ('normalized_name', 'bias_source', 'name', 'outlet_name')
ORDER BY ordinal_position;

-- 2. Force add the columns (sometimes IF NOT EXISTS doesn't work properly)
DO $$
BEGIN
    -- Add normalized_name if it doesn't exist
    BEGIN
        ALTER TABLE sources ADD COLUMN normalized_name VARCHAR(255);
        RAISE NOTICE 'Added normalized_name column';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'normalized_name column already exists';
    END;
    
    -- Add bias_source if it doesn't exist
    BEGIN
        ALTER TABLE sources ADD COLUMN bias_source VARCHAR(100);
        RAISE NOTICE 'Added bias_source column';
    EXCEPTION
        WHEN duplicate_column THEN
            RAISE NOTICE 'bias_source column already exists';
    END;
END $$;

-- 3. Populate normalized_name for any existing records
UPDATE sources 
SET normalized_name = LOWER(REGEXP_REPLACE(COALESCE(name, outlet_name, 'source_' || source_id), '[^a-z0-9]+', '_', 'g'))
WHERE normalized_name IS NULL;

-- 4. Set default bias_source
UPDATE sources 
SET bias_source = 'manual'
WHERE bias_source IS NULL;

-- 5. Multiple methods to force schema cache refresh
-- Method 1: NOTIFY
NOTIFY pgrst, 'reload schema';

-- Method 2: Create and drop a dummy function
CREATE OR REPLACE FUNCTION _force_schema_reload_temp() RETURNS void AS $$
BEGIN
    RAISE NOTICE 'Forcing schema reload';
END;
$$ LANGUAGE plpgsql;
DROP FUNCTION _force_schema_reload_temp();

-- Method 3: Alter table comment (this often triggers a reload)
COMMENT ON TABLE sources IS 'News sources with bias and reliability metrics - updated';

-- 6. Verify the columns now exist
SELECT 'After update - checking columns:' as info;
SELECT 
    table_name,
    column_name,
    data_type,
    CASE 
        WHEN column_name IN ('normalized_name', 'bias_source', 'casualties') THEN '✅ Required'
        ELSE '📌 Extra'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (
        (table_name = 'sources' AND column_name IN ('normalized_name', 'bias_source', 'name', 'outlet_name'))
        OR
        (table_name = 'events' AND column_name = 'casualties')
    )
ORDER BY table_name, column_name;

-- 7. If columns still don't show up in API, you need to:
-- Option A: In Supabase Dashboard, go to Settings > API > Click "Reload schema now"
-- Option B: Restart your Supabase project
-- Option C: Wait 1-2 minutes for automatic cache refresh