-- Fix language issue in sources table

-- 1. Check if language column exists and its constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sources' 
    AND column_name = 'language'
    AND table_schema = 'public';

-- 2. Make language nullable
ALTER TABLE sources ALTER COLUMN language DROP NOT NULL;

-- 3. Set a default value of 'en'
ALTER TABLE sources ALTER COLUMN language SET DEFAULT 'en';

-- 4. Update existing null values
UPDATE sources 
SET language = COALESCE((metadata->>'language')::text, 'en')
WHERE language IS NULL;

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
    AND column_name = 'language'
ORDER BY column_name;