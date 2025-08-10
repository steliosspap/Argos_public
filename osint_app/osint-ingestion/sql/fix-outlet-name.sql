-- Fix outlet_name issue in sources table

-- 1. Check if outlet_name column exists and its constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sources' 
    AND column_name = 'outlet_name'
    AND table_schema = 'public';

-- 2. Make outlet_name nullable OR add a default
-- Option A: Make it nullable (recommended)
ALTER TABLE sources ALTER COLUMN outlet_name DROP NOT NULL;

-- Option B: Set default to name if preferred (uncomment below)
-- ALTER TABLE sources ALTER COLUMN outlet_name SET DEFAULT 'unknown';

-- 3. Update existing records where outlet_name is null
UPDATE sources 
SET outlet_name = name 
WHERE outlet_name IS NULL;

-- 4. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 5. Verify the change
SELECT 'After fix:' as status;
SELECT 
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sources' 
    AND column_name IN ('outlet_name', 'name')
ORDER BY column_name;