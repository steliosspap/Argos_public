-- Migration: Add asymmetric escalation decay for conflict zones
-- This implements fast rise, slow decay for escalation scores

-- Add columns to store escalation state
ALTER TABLE conflicts 
ADD COLUMN IF NOT EXISTS previous_escalation_score DECIMAL(3,1) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS escalation_event_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS escalation_last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function for asymmetric escalation calculation
CREATE OR REPLACE FUNCTION calculate_asymmetric_escalation(
    p_conflict_id UUID,
    p_new_events JSONB[] DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
    v_previous_score DECIMAL(3,1);
    v_last_updated TIMESTAMP WITH TIME ZONE;
    v_event_ids TEXT[];
    v_hours_since_update DECIMAL;
    v_decayed_score DECIMAL(3,1);
    v_new_events_avg DECIMAL(3,1);
    v_combined_score DECIMAL(3,1);
    v_new_event_ids TEXT[];
    
    -- Constants
    c_inertia_factor CONSTANT DECIMAL := 0.75;  -- Weight for previous score (75%)
    c_new_event_factor CONSTANT DECIMAL := 0.25; -- Weight for new events (25%)
    c_decay_window_hours CONSTANT INTEGER := 12; -- Hours before decay starts
    c_decay_rate_per_hour CONSTANT DECIMAL := 0.02; -- 2% decay per hour after window
    c_slow_decay_inertia CONSTANT DECIMAL := 0.9; -- 90% weight when de-escalating
    c_min_score CONSTANT DECIMAL := 1.0;
    c_max_score CONSTANT DECIMAL := 10.0;
BEGIN
    -- Get previous state
    SELECT 
        COALESCE(previous_escalation_score, escalation_score::DECIMAL),
        escalation_last_calculated,
        escalation_event_ids
    INTO 
        v_previous_score,
        v_last_updated,
        v_event_ids
    FROM conflicts
    WHERE id = p_conflict_id;
    
    -- If no previous score, return current score
    IF v_previous_score IS NULL THEN
        RETURN (SELECT escalation_score FROM conflicts WHERE id = p_conflict_id);
    END IF;
    
    -- Calculate time decay
    v_hours_since_update := EXTRACT(EPOCH FROM (NOW() - v_last_updated)) / 3600.0;
    v_decayed_score := v_previous_score;
    
    IF v_hours_since_update > c_decay_window_hours THEN
        -- Apply decay after window
        v_decayed_score := v_previous_score * POWER(1 - c_decay_rate_per_hour, 
                                                    v_hours_since_update - c_decay_window_hours);
    END IF;
    
    -- If no new events, just return decayed score
    IF p_new_events IS NULL OR array_length(p_new_events, 1) IS NULL THEN
        RETURN LEAST(c_max_score, GREATEST(c_min_score, v_decayed_score));
    END IF;
    
    -- Calculate average score of new events
    WITH new_event_scores AS (
        SELECT 
            (event_data->>'escalation_score')::DECIMAL as score,
            event_data->>'id' as event_id
        FROM unnest(p_new_events) as event_data
        WHERE event_data->>'id' NOT IN (SELECT unnest(v_event_ids))
    )
    SELECT 
        AVG(score),
        array_agg(event_id)
    INTO 
        v_new_events_avg,
        v_new_event_ids
    FROM new_event_scores;
    
    -- If no genuinely new events, return decayed score
    IF v_new_events_avg IS NULL THEN
        RETURN LEAST(c_max_score, GREATEST(c_min_score, v_decayed_score));
    END IF;
    
    -- Apply asymmetric weighting
    IF v_new_events_avg > v_decayed_score THEN
        -- Escalation rises quickly - use standard weighting
        v_combined_score := c_inertia_factor * v_decayed_score + 
                           c_new_event_factor * v_new_events_avg;
    ELSE
        -- De-escalation is slower - increase inertia
        v_combined_score := c_slow_decay_inertia * v_decayed_score + 
                           (1 - c_slow_decay_inertia) * v_new_events_avg;
    END IF;
    
    -- Update conflict with new escalation data
    UPDATE conflicts
    SET 
        previous_escalation_score = escalation_score::DECIMAL,
        escalation_score = ROUND(LEAST(c_max_score, GREATEST(c_min_score, v_combined_score)))::INTEGER,
        escalation_last_calculated = NOW(),
        escalation_event_ids = array_cat(
            v_event_ids[array_upper(v_event_ids, 1) - 99:], -- Keep last 100 event IDs
            v_new_event_ids
        ),
        updated_at = NOW()
    WHERE id = p_conflict_id;
    
    RETURN LEAST(c_max_score, GREATEST(c_min_score, v_combined_score));
END;
$$ LANGUAGE plpgsql;

-- Create function to update all active conflicts
CREATE OR REPLACE FUNCTION update_all_conflict_escalations() RETURNS TABLE(
    conflict_id UUID,
    conflict_name TEXT,
    old_score INTEGER,
    new_score DECIMAL,
    score_change DECIMAL
) AS $$
DECLARE
    v_conflict RECORD;
    v_new_events JSONB[];
    v_new_score DECIMAL;
BEGIN
    FOR v_conflict IN 
        SELECT id, name, escalation_score
        FROM conflicts
        WHERE status = 'active'
    LOOP
        -- Get recent events for this conflict's region/country
        WITH recent_events AS (
            SELECT jsonb_build_object(
                'id', e.id::TEXT,
                'escalation_score', e.escalation_score
            ) as event_data
            FROM events e
            WHERE e.country = (SELECT country FROM conflicts WHERE id = v_conflict.id)
            AND e.timestamp > NOW() - INTERVAL '24 hours'
            AND e.escalation_score IS NOT NULL
            ORDER BY e.timestamp DESC
            LIMIT 20
        )
        SELECT array_agg(event_data)
        INTO v_new_events
        FROM recent_events;
        
        -- Calculate new escalation score
        v_new_score := calculate_asymmetric_escalation(v_conflict.id, v_new_events);
        
        -- Return result
        conflict_id := v_conflict.id;
        conflict_name := v_conflict.name;
        old_score := v_conflict.escalation_score;
        new_score := v_new_score;
        score_change := v_new_score - v_conflict.escalation_score;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled function to update escalations periodically
CREATE OR REPLACE FUNCTION scheduled_escalation_update() RETURNS void AS $$
BEGIN
    -- Log the update
    INSERT INTO conflict_sync_log (operation, message, details)
    VALUES (
        'ESCALATION_UPDATE',
        'Running scheduled escalation score update',
        jsonb_build_object(
            'timestamp', NOW(),
            'active_conflicts', (SELECT COUNT(*) FROM conflicts WHERE status = 'active')
        )
    );
    
    -- Perform the update
    PERFORM update_all_conflict_escalations();
    
    -- Log completion
    INSERT INTO conflict_sync_log (operation, affected_rows, message)
    VALUES (
        'ESCALATION_UPDATE_COMPLETE',
        (SELECT COUNT(*) FROM conflicts WHERE status = 'active'),
        'Completed escalation score update'
    );
END;
$$ LANGUAGE plpgsql;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_conflicts_escalation_calc 
ON conflicts(status, country, escalation_last_calculated);

-- Add comment explaining the asymmetric decay
COMMENT ON FUNCTION calculate_asymmetric_escalation IS 
'Calculates escalation score with asymmetric decay: fast to rise (25% weight for increases) but slow to fall (10% weight for decreases). Includes time-based decay after 12 hours.';

-- Create helper function to update conflicts for a specific country
CREATE OR REPLACE FUNCTION update_country_conflict_escalations(
    p_country TEXT,
    p_new_events JSONB[]
) RETURNS void AS $$
DECLARE
    v_conflict RECORD;
BEGIN
    -- Update all active conflicts in the specified country
    FOR v_conflict IN 
        SELECT id
        FROM conflicts
        WHERE country = p_country
        AND status = 'active'
    LOOP
        PERFORM calculate_asymmetric_escalation(v_conflict.id, p_new_events);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Test the function with sample data
SELECT * FROM update_all_conflict_escalations()
ORDER BY score_change DESC;