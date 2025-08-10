-- Simple fixes that don't conflict with views

-- 1. Fix sources table id column
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

-- 2. Make region column nullable
ALTER TABLE events ALTER COLUMN region DROP NOT NULL;

-- 3. Add missing columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2) DEFAULT 0.8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_multi_source BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;

-- 4. Ensure bias_source column exists in sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS bias_source VARCHAR(100);

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 6. Verify
SELECT 'Verification:' as info;
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND (
        (table_name = 'sources' AND column_name IN ('id', 'source_id', 'bias_source'))
        OR
        (table_name = 'events' AND column_name IN ('reliability', 'region'))
    )
ORDER BY table_name, column_name;