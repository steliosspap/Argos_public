-- Fix for automatic escalation score updates
-- This creates a trigger that updates conflict escalation scores whenever new events are inserted

-- First, create a simplified trigger function that calls the existing update
CREATE OR REPLACE FUNCTION trigger_conflict_escalation_update()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Check if there's a matching conflict for this event
    SELECT COUNT(*) INTO conflict_count
    FROM conflicts
    WHERE country = NEW.country 
    AND region = NEW.region
    AND status = 'active';
    
    -- If there's a matching conflict, schedule an escalation update
    IF conflict_count > 0 THEN
        -- Log the trigger activation
        INSERT INTO conflict_sync_log (
            operation,
            message,
            details,
            created_at
        ) VALUES (
            'TRIGGER_ESCALATION',
            'Event inserted for ' || NEW.country || ' - ' || NEW.region,
            jsonb_build_object(
                'event_id', NEW.id,
                'severity', NEW.severity,
                'escalation_score', NEW.escalation_score
            ),
            NOW()
        );
        
        -- Mark that an update is needed (this avoids doing heavy calculation in trigger)
        UPDATE conflicts
        SET escalation_last_calculated = NOW() - INTERVAL '1 hour' -- Force recalculation
        WHERE country = NEW.country 
        AND region = NEW.region
        AND status = 'active';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS after_event_insert_escalation ON events;
CREATE TRIGGER after_event_insert_escalation
AFTER INSERT ON events
FOR EACH ROW
WHEN (NEW.escalation_score IS NOT NULL AND NEW.escalation_score > 0)
EXECUTE FUNCTION trigger_conflict_escalation_update();

-- Create a function to run periodic escalation updates
CREATE OR REPLACE FUNCTION run_escalation_updates()
RETURNS TABLE(
    updated_count INTEGER,
    error_count INTEGER,
    message TEXT
) AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_conflict RECORD;
    v_events_count INTEGER;
    v_latest_score NUMERIC;
    v_new_score INTEGER;
BEGIN
    -- Process each active conflict that needs updating
    FOR v_conflict IN 
        SELECT c.*
        FROM conflicts c
        WHERE c.status = 'active'
        AND (
            c.escalation_last_calculated IS NULL 
            OR c.escalation_last_calculated < NOW() - INTERVAL '5 minutes'
        )
        ORDER BY c.escalation_last_calculated ASC NULLS FIRST
    LOOP
        BEGIN
            -- Count recent events (last 12 hours)
            SELECT COUNT(*), AVG(escalation_score)
            INTO v_events_count, v_latest_score
            FROM events
            WHERE country = v_conflict.country
            AND region = v_conflict.region
            AND timestamp > NOW() - INTERVAL '12 hours';
            
            -- Calculate new score
            IF v_events_count > 0 AND v_latest_score IS NOT NULL THEN
                -- Apply smoothing: 75% old + 25% new
                v_new_score := ROUND(
                    0.75 * COALESCE(v_conflict.escalation_score, 0) + 
                    0.25 * v_latest_score
                );
            ELSE
                -- No events - apply decay
                v_new_score := ROUND(COALESCE(v_conflict.escalation_score, 0) * 0.95);
            END IF;
            
            -- Ensure bounds
            v_new_score := GREATEST(0, LEAST(10, v_new_score));
            
            -- Update if changed
            IF v_new_score != COALESCE(v_conflict.escalation_score, 0) THEN
                UPDATE conflicts
                SET escalation_score = v_new_score,
                    previous_escalation_score = v_conflict.escalation_score,
                    escalation_last_calculated = NOW(),
                    updated_at = NOW()
                WHERE id = v_conflict.id;
                
                v_updated_count := v_updated_count + 1;
            ELSE
                -- Update timestamp even if score didn't change
                UPDATE conflicts
                SET escalation_last_calculated = NOW()
                WHERE id = v_conflict.id;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            -- Log error
            INSERT INTO conflict_sync_log (
                operation,
                message,
                details,
                created_at
            ) VALUES (
                'ESCALATION_ERROR',
                'Error updating ' || v_conflict.name,
                jsonb_build_object('error', SQLERRM),
                NOW()
            );
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_updated_count, v_error_count, 
        format('Updated %s conflicts, %s errors', v_updated_count, v_error_count);
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT * FROM run_escalation_updates();

-- Show recent conflict updates
SELECT 
    name,
    country,
    region,
    escalation_score,
    previous_escalation_score,
    escalation_last_calculated
FROM conflicts
WHERE status = 'active'
AND escalation_last_calculated IS NOT NULL
ORDER BY escalation_last_calculated DESC
LIMIT 10;