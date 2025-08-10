-- Check ID generation for sources table

-- 1. Check if sources.id has a default value
SELECT 
    table_name,
    column_name,
    column_default,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sources' 
    AND column_name = 'id'
    AND table_schema = 'public';

-- 2. Check if events.channel exists and its constraints
SELECT 
    table_name,
    column_name,
    column_default,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'events' 
    AND column_name = 'channel'
    AND table_schema = 'public';

-- 3. Add default UUID generation to sources.id if missing
ALTER TABLE sources ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. Make channel nullable or add a default value
-- Option A: Make it nullable
ALTER TABLE events ALTER COLUMN channel DROP NOT NULL;

-- Option B: Add a default value (uncomment if preferred)
-- ALTER TABLE events ALTER COLUMN channel SET DEFAULT 'news';

-- 5. Verify the changes
SELECT 'After fixes:' as status;
SELECT 
    table_name,
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE (table_name = 'sources' AND column_name = 'id')
   OR (table_name = 'events' AND column_name = 'channel')
ORDER BY table_name, column_name;