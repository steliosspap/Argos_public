-- Fix sources table to match what the code expects

-- 1. Add missing columns to sources table
ALTER TABLE sources ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS bias_source VARCHAR(100);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(100);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_bias_update TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Create unique constraint on normalized_name if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sources_normalized_name_key'
    ) THEN
        -- First, populate normalized_name for existing records
        UPDATE sources 
        SET normalized_name = LOWER(REGEXP_REPLACE(COALESCE(name, outlet_name, 'unknown'), '[^a-z0-9]+', '_', 'g'))
        WHERE normalized_name IS NULL;
        
        -- Then add the unique constraint
        ALTER TABLE sources ADD CONSTRAINT sources_normalized_name_key UNIQUE (normalized_name);
    END IF;
END $$;

-- 3. Map existing columns to expected ones (using triggers for compatibility)
-- Create a trigger to sync reliability_score with overall_reliability
CREATE OR REPLACE FUNCTION sync_reliability_score()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- If reliability_score is provided, update overall_reliability
        IF NEW.reliability_score IS NOT NULL THEN
            NEW.overall_reliability = NEW.reliability_score / 100.0;
        -- If overall_reliability exists, calculate reliability_score
        ELSIF NEW.overall_reliability IS NOT NULL THEN
            NEW.reliability_score = ROUND(NEW.overall_reliability * 100);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_reliability_trigger ON sources;
CREATE TRIGGER sync_reliability_trigger
BEFORE INSERT OR UPDATE ON sources
FOR EACH ROW EXECUTE FUNCTION sync_reliability_score();

-- 4. Update existing records to have normalized_name
UPDATE sources 
SET normalized_name = LOWER(REGEXP_REPLACE(COALESCE(name, outlet_name, 'unknown_' || source_id), '[^a-z0-9]+', '_', 'g'))
WHERE normalized_name IS NULL;

-- 5. Set default values for new required columns
UPDATE sources SET website = base_url WHERE website IS NULL AND base_url IS NOT NULL;
UPDATE sources SET reliability_score = ROUND(overall_reliability * 100) WHERE reliability_score IS NULL;
UPDATE sources SET bias_source = 'manual' WHERE bias_source IS NULL;

-- 6. Add casualties column to events table if it doesn't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS casualties JSONB DEFAULT '{"killed": 0, "wounded": 0}';

-- 7. Force schema reload
NOTIFY pgrst, 'reload schema';

-- 8. Verify the changes
SELECT 'Sources table - new columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sources' 
  AND column_name IN ('normalized_name', 'bias_source', 'reliability_score', 'website', 'country_of_origin')
ORDER BY column_name;

SELECT 'Events table - casualties column:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events' 
  AND column_name = 'casualties';