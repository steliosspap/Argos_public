-- Fix source_type issue in sources table

-- 1. Check if source_type column exists and its constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sources' 
    AND column_name = 'source_type'
    AND table_schema = 'public';

-- 2. Make source_type nullable since it's not being provided directly
ALTER TABLE sources ALTER COLUMN source_type DROP NOT NULL;

-- 3. Set a default value of 'news'
ALTER TABLE sources ALTER COLUMN source_type SET DEFAULT 'news';

-- 4. Update existing null values
UPDATE sources 
SET source_type = COALESCE((metadata->>'sourceType')::text, 'news')
WHERE source_type IS NULL;

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 6. Verify the changes
SELECT 'After fix:' as status;
SELECT 
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sources' 
    AND column_name = 'source_type'
ORDER BY column_name;