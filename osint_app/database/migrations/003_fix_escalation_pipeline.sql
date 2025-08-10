-- Fix the Broken Escalation Pipeline
-- This creates automatic updates when events are inserted
-- Run this in Supabase SQL Editor

-- First, add missing columns to conflicts table if they don't exist
ALTER TABLE conflicts 
ADD COLUMN IF NOT EXISTS previous_escalation_score NUMERIC,
ADD COLUMN IF NOT EXISTS escalation_event_ids TEXT[],
ADD COLUMN IF NOT EXISTS escalation_last_calculated TIMESTAMPTZ;

-- Create function to calculate escalation from events
CREATE OR REPLACE FUNCTION calculate_conflict_escalation(
    p_country TEXT,
    p_region TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_score NUMERIC := 0;
    v_event_count INTEGER;
    v_avg_severity NUMERIC;
BEGIN
    -- Get recent events (last 12 hours)
    SELECT 
        COUNT(*),
        AVG(CASE 
            WHEN severity = 'critical' THEN 4
            WHEN severity = 'high' THEN 3
            WHEN severity = 'medium' THEN 2
            WHEN severity = 'low' THEN 1
            ELSE 1
        END) * 2.5  -- Scale to 0-10
    INTO v_event_count, v_avg_severity
    FROM events
    WHERE country = p_country
      AND region = p_region
      AND timestamp > NOW() - INTERVAL '12 hours';
    
    IF v_event_count > 0 AND v_avg_severity IS NOT NULL THEN
        v_score := v_avg_severity;
    END IF;
    
    -- Ensure score is within bounds
    RETURN GREATEST(0, LEAST(10, ROUND(v_score)));
END;
$$ LANGUAGE plpgsql;

-- Create function to update a single conflict's escalation
CREATE OR REPLACE FUNCTION update_single_conflict_escalation(
    p_conflict_id UUID
) RETURNS void AS $$
DECLARE
    v_conflict RECORD;
    v_new_score INTEGER;
    v_current_score INTEGER;
BEGIN
    -- Get conflict details
    SELECT * INTO v_conflict
    FROM conflicts
    WHERE id = p_conflict_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate new score from events
    v_new_score := calculate_conflict_escalation(v_conflict.country, v_conflict.region);
    v_current_score := COALESCE(v_conflict.escalation_score, 0);
    
    -- Apply smoothing: 75% old + 25% new for increases
    IF v_new_score > 0 THEN
        v_new_score := ROUND(0.75 * v_current_score + 0.25 * v_new_score);
    ELSE
        -- Apply decay: 95% of current score when no events
        v_new_score := ROUND(0.95 * v_current_score);
    END IF;
    
    -- Update if changed
    IF v_new_score != v_current_score THEN
        UPDATE conflicts
        SET 
            escalation_score = v_new_score,
            previous_escalation_score = v_current_score,
            escalation_last_calculated = NOW(),
            updated_at = NOW()
        WHERE id = p_conflict_id;
    ELSE
        -- Just update the timestamp
        UPDATE conflicts
        SET escalation_last_calculated = NOW()
        WHERE id = p_conflict_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create lightweight trigger to mark conflicts for update
CREATE OR REPLACE FUNCTION trigger_mark_conflict_for_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark conflicts in the same region for update
    UPDATE conflicts
    SET escalation_last_calculated = NOW() - INTERVAL '1 hour'
    WHERE country = NEW.country 
      AND region = NEW.region
      AND status = 'active';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS after_event_insert_mark_conflicts ON events;
CREATE TRIGGER after_event_insert_mark_conflicts
AFTER INSERT ON events
FOR EACH ROW
WHEN (NEW.escalation_score IS NOT NULL)
EXECUTE FUNCTION trigger_mark_conflict_for_update();

-- Create function to process all pending updates
CREATE OR REPLACE FUNCTION process_all_pending_escalations()
RETURNS TABLE(
    conflicts_updated INTEGER,
    conflicts_processed INTEGER
) AS $$
DECLARE
    v_updated INTEGER := 0;
    v_processed INTEGER := 0;
    v_conflict RECORD;
BEGIN
    -- Process conflicts that need updating
    FOR v_conflict IN 
        SELECT id, name
        FROM conflicts
        WHERE status = 'active'
        AND (escalation_last_calculated IS NULL 
             OR escalation_last_calculated < NOW() - INTERVAL '5 minutes')
        ORDER BY escalation_last_calculated ASC NULLS FIRST
    LOOP
        v_processed := v_processed + 1;
        
        -- Get the old score for comparison
        DECLARE
            v_old_score INTEGER;
        BEGIN
            SELECT escalation_score INTO v_old_score
            FROM conflicts WHERE id = v_conflict.id;
            
            -- Update the conflict
            PERFORM update_single_conflict_escalation(v_conflict.id);
            
            -- Check if it was actually updated
            IF (SELECT escalation_score FROM conflicts WHERE id = v_conflict.id) != COALESCE(v_old_score, 0) THEN
                v_updated := v_updated + 1;
            END IF;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_updated, v_processed;
END;
$$ LANGUAGE plpgsql;

-- Run initial update for all active conflicts
SELECT * FROM process_all_pending_escalations();

-- Show current escalation scores
SELECT 
    name,
    country,
    region,
    escalation_score,
    previous_escalation_score,
    escalation_last_calculated
FROM conflicts
WHERE status = 'active'
ORDER BY escalation_score DESC NULLS LAST
LIMIT 20;