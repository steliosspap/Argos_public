-- Alternative methods to force PostgREST to recognize new columns

-- Method 1: Create a new table and trigger reload
CREATE TABLE IF NOT EXISTS _temp_schema_reload (id serial primary key);
DROP TABLE IF EXISTS _temp_schema_reload;

-- Method 2: Modify PostgREST schema cache directly
-- This sends multiple notifications
DO $$
DECLARE
    i integer;
BEGIN
    FOR i IN 1..5 LOOP
        NOTIFY pgrst, 'reload schema';
        PERFORM pg_sleep(0.1);
    END LOOP;
END $$;

-- Method 3: Create a view that includes the columns
-- Sometimes creating a view forces recognition
CREATE OR REPLACE VIEW sources_view AS
SELECT 
    source_id,
    name,
    normalized_name,
    bias_source,
    bias_score,
    reliability_score,
    website,
    country_of_origin,
    metadata,
    created_at,
    updated_at
FROM sources;

-- Then drop it
DROP VIEW IF EXISTS sources_view;

-- Method 4: Add and remove a column to force table re-scan
ALTER TABLE sources ADD COLUMN _temp_reload boolean DEFAULT false;
ALTER TABLE sources DROP COLUMN _temp_reload;

-- Check one more time
SELECT 'Final check - these columns should exist:' as status;
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('sources', 'events')
    AND column_name IN ('normalized_name', 'bias_source', 'casualties')
ORDER BY table_name, column_name;