-- Fix event_groups table constraints

-- 1. Check current structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'event_groups' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Make optional fields nullable
ALTER TABLE event_groups ALTER COLUMN source_diversity_score DROP NOT NULL;
ALTER TABLE event_groups ALTER COLUMN bias_distribution DROP NOT NULL;
ALTER TABLE event_groups ALTER COLUMN average_reliability DROP NOT NULL;
ALTER TABLE event_groups ALTER COLUMN generated_headline DROP NOT NULL;

-- 3. Add default values for optional fields
ALTER TABLE event_groups ALTER COLUMN source_diversity_score SET DEFAULT 0.5;
ALTER TABLE event_groups ALTER COLUMN bias_distribution SET DEFAULT '{}';
ALTER TABLE event_groups ALTER COLUMN average_reliability SET DEFAULT 0.5;

-- 4. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 5. Verify the changes
SELECT 'After fix:' as status;
SELECT 
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'event_groups' 
    AND column_name IN ('source_diversity_score', 'bias_distribution', 'average_reliability', 'generated_headline')
ORDER BY column_name;