-- Create event_groups table

-- 1. Create the event_groups table based on the supabase-v2-migration schema
CREATE TABLE IF NOT EXISTS event_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_ids UUID[] NOT NULL,
  primary_event_id UUID REFERENCES events(id),
  group_confidence DECIMAL(3,2),
  corroboration_count INTEGER,
  source_diversity_score DECIMAL(3,2),
  generated_headline TEXT,
  bias_distribution JSONB DEFAULT '{}',
  average_reliability DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create index for efficient lookups
CREATE INDEX idx_event_groups_primary_event ON event_groups(primary_event_id);
CREATE INDEX idx_event_groups_event_ids ON event_groups USING GIN(event_ids);

-- 3. Add comment
COMMENT ON TABLE event_groups IS 'Groups of related events that describe the same incident from multiple sources';

-- 4. Verify creation
SELECT 'Table created:' as status;
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'event_groups' 
    AND table_schema = 'public';

-- 5. Show columns
SELECT 'Columns:' as status;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'event_groups' 
    AND table_schema = 'public'
ORDER BY ordinal_position;