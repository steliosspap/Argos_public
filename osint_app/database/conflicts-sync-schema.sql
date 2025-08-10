-- Conflicts Table Schema Update for Real-Time News Sync
-- Run this script in Supabase SQL Editor

-- Add new columns for news sync integration
ALTER TABLE conflicts 
ADD COLUMN IF NOT EXISTS source_article_id UUID REFERENCES news(id),
ADD COLUMN IF NOT EXISTS headline_hash VARCHAR(50),
ADD COLUMN IF NOT EXISTS sync_source VARCHAR(20) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_news_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS conflict_hash VARCHAR(20),
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.0;

-- Update existing escalation_score column if it doesn't exist
ALTER TABLE conflicts 
ADD COLUMN IF NOT EXISTS escalation_score INTEGER DEFAULT 5;

-- Add constraints
ALTER TABLE conflicts 
ADD CONSTRAINT IF NOT EXISTS check_escalation_score_range 
CHECK (escalation_score >= 0 AND escalation_score <= 10);

ALTER TABLE conflicts 
ADD CONSTRAINT IF NOT EXISTS check_confidence_score_range 
CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conflicts_source_article_id ON conflicts(source_article_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_headline_hash ON conflicts(headline_hash);
CREATE INDEX IF NOT EXISTS idx_conflicts_conflict_hash ON conflicts(conflict_hash);
CREATE INDEX IF NOT EXISTS idx_conflicts_last_news_update ON conflicts(last_news_update);
CREATE INDEX IF NOT EXISTS idx_conflicts_sync_source ON conflicts(sync_source);
CREATE INDEX IF NOT EXISTS idx_conflicts_auto_generated ON conflicts(auto_generated);

-- Add composite index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_conflicts_sync_lookup 
ON conflicts(country, region, conflict_hash, auto_generated);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_conflicts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_conflicts_updated_at ON conflicts;
CREATE TRIGGER trigger_conflicts_updated_at
    BEFORE UPDATE ON conflicts
    FOR EACH ROW
    EXECUTE FUNCTION update_conflicts_updated_at();

-- Create function for conflict expiration (mark as resolved after 48h of inactivity)
CREATE OR REPLACE FUNCTION expire_inactive_conflicts()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Mark conflicts as resolved if no news updates in 48 hours
    UPDATE conflicts 
    SET 
        status = 'resolved',
        updated_at = NOW()
    WHERE 
        status = 'active' 
        AND auto_generated = true
        AND (last_news_update < NOW() - INTERVAL '48 hours' OR last_news_update IS NULL)
        AND updated_at < NOW() - INTERVAL '48 hours';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log the expiration
    INSERT INTO conflict_sync_log (
        operation, 
        affected_rows, 
        message, 
        created_at
    ) VALUES (
        'EXPIRE_CONFLICTS', 
        expired_count, 
        'Expired ' || expired_count || ' inactive conflicts after 48h',
        NOW()
    );
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Create conflict sync log table for debugging and monitoring
CREATE TABLE IF NOT EXISTS conflict_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation VARCHAR(50) NOT NULL,
    affected_rows INTEGER DEFAULT 0,
    message TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on sync log
CREATE INDEX IF NOT EXISTS idx_conflict_sync_log_created_at ON conflict_sync_log(created_at);
CREATE INDEX IF NOT EXISTS idx_conflict_sync_log_operation ON conflict_sync_log(operation);

-- Insert some sample data for testing (if table is empty)
INSERT INTO conflicts (
    name, country, region, latitude, longitude, 
    conflict_type, status, description, escalation_score,
    start_date, updated_at, auto_generated, sync_source
) 
SELECT * FROM (
    VALUES 
    (
        'Gaza Conflict 2024', 'Palestine', 'Middle East', 31.3547, 34.3088,
        'occupation', 'active', 'Ongoing conflict in Gaza Strip with high casualties',
        9, '2023-10-07', NOW(), true, 'news_sync'
    ),
    (
        'Ukraine War', 'Ukraine', 'Europe', 50.4501, 30.5234,
        'occupation', 'active', 'Russian invasion of Ukraine continuing',
        8, '2022-02-24', NOW(), true, 'news_sync'
    ),
    (
        'Sudan Civil Conflict', 'Sudan', 'Africa', 15.5007, 32.5599,
        'civil_war', 'active', 'Internal conflict between military factions',
        7, '2023-04-15', NOW(), true, 'news_sync'
    )
) AS new_conflicts(name, country, region, latitude, longitude, conflict_type, status, description, escalation_score, start_date, updated_at, auto_generated, sync_source)
WHERE NOT EXISTS (SELECT 1 FROM conflicts WHERE auto_generated = true);

-- Set up RLS policies for the new fields
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;

-- Update existing RLS policy to include new columns
DROP POLICY IF EXISTS "Enable read access for all users" ON conflicts;
CREATE POLICY "Enable read access for all users" 
ON conflicts FOR SELECT 
USING (true);

-- Allow inserts and updates for service role (used by sync script)
DROP POLICY IF EXISTS "Enable insert for service role" ON conflicts;
CREATE POLICY "Enable insert for service role" 
ON conflicts FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for service role" ON conflicts;
CREATE POLICY "Enable update for service role" 
ON conflicts FOR UPDATE 
USING (true);

-- Create a view for active conflicts only
CREATE OR REPLACE VIEW active_conflicts AS
SELECT 
    id, name, country, region, latitude, longitude,
    conflict_type, status, description, casualties,
    escalation_score, start_date, updated_at,
    source_article_id, confidence_score, last_news_update
FROM conflicts 
WHERE status = 'active'
ORDER BY escalation_score DESC, updated_at DESC;

-- Verify the schema updates
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'conflicts' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show current conflicts data
SELECT 
    name,
    country,
    region,
    status,
    escalation_score,
    auto_generated,
    sync_source,
    updated_at
FROM conflicts
ORDER BY updated_at DESC
LIMIT 10;