-- Add deletion_notes column to events table for additional archiving context
ALTER TABLE events ADD COLUMN IF NOT EXISTS deletion_notes TEXT;

-- Drop and recreate the archived_events view to include deletion_notes
DROP VIEW IF EXISTS archived_events;
CREATE VIEW archived_events AS
SELECT 
    e.id,
    e.title,
    e.summary,
    COALESCE(ST_Y(e.location::geometry), e.latitude) as latitude,
    COALESCE(ST_X(e.location::geometry), e.longitude) as longitude,
    e.country,
    e.region,
    e.timestamp,
    e.channel,
    e.reliability,
    e.event_classifier,
    e.severity,
    e.source_url,
    e.created_at,
    e.updated_at,
    e.deleted,
    e.deleted_at,
    e.deleted_by,
    e.deletion_reason,
    e.deletion_notes,
    u.email as deleted_by_email,
    u.name as deleted_by_name
FROM events e
LEFT JOIN users u ON e.deleted_by = u.id
WHERE e.deleted = TRUE;

-- Add deletion_notes to event_deletion_log table
ALTER TABLE event_deletion_log ADD COLUMN IF NOT EXISTS deletion_notes TEXT;

-- Update the trigger to include deletion_notes in the audit log
CREATE OR REPLACE FUNCTION log_event_deletion() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted = TRUE AND (OLD.deleted IS NULL OR OLD.deleted = FALSE) THEN
        INSERT INTO event_deletion_log (
            event_id,
            deleted_by,
            deletion_reason,
            deletion_notes,
            event_snapshot,
            user_email,
            user_name
        )
        SELECT 
            NEW.id,
            NEW.deleted_by,
            NEW.deletion_reason,
            NEW.deletion_notes,
            to_jsonb(OLD),
            u.email,
            u.name
        FROM users u
        WHERE u.id = NEW.deleted_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is properly set
DROP TRIGGER IF EXISTS event_deletion_audit_trigger ON events;
CREATE TRIGGER event_deletion_audit_trigger
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION log_event_deletion();