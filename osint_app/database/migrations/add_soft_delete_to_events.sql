-- Add soft delete functionality to events table
-- This migration adds columns for tracking deleted events and who deleted them

-- Add soft delete columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_deleted ON events(deleted);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at) WHERE deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_events_deleted_by ON events(deleted_by) WHERE deleted = TRUE;

-- Update the events_with_coords view to exclude deleted events by default
CREATE OR REPLACE VIEW events_with_coords AS
SELECT 
    id,
    title,
    summary,
    COALESCE(ST_Y(location::geometry), latitude) as latitude,
    COALESCE(ST_X(location::geometry), longitude) as longitude,
    country,
    region,
    timestamp,
    channel,
    reliability,
    event_classifier,
    severity,
    source_url,
    created_at,
    updated_at
FROM events
WHERE deleted = FALSE;

-- Create a view for archived (deleted) events for admin access
CREATE OR REPLACE VIEW archived_events AS
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
    u.email as deleted_by_email,
    u.name as deleted_by_name
FROM events e
LEFT JOIN users u ON e.deleted_by = u.id
WHERE e.deleted = TRUE;

-- Create audit log table for tracking all deletion actions
CREATE TABLE IF NOT EXISTS event_deletion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    deleted_by UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deletion_reason TEXT,
    event_snapshot JSONB NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL
);

-- Create index for audit log
CREATE INDEX IF NOT EXISTS idx_event_deletion_log_event_id ON event_deletion_log(event_id);
CREATE INDEX IF NOT EXISTS idx_event_deletion_log_deleted_by ON event_deletion_log(deleted_by);
CREATE INDEX IF NOT EXISTS idx_event_deletion_log_deleted_at ON event_deletion_log(deleted_at DESC);

-- Add RLS policies for deletion log (admin only)
ALTER TABLE event_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view deletion logs" ON event_deletion_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Update RLS policy for events to allow admin deletion
CREATE POLICY "Admins can update events for deletion" ON events
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create function to log deletions
CREATE OR REPLACE FUNCTION log_event_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the event is being marked as deleted
    IF NEW.deleted = TRUE AND OLD.deleted = FALSE THEN
        INSERT INTO event_deletion_log (
            event_id,
            deleted_by,
            deletion_reason,
            event_snapshot,
            user_email,
            user_name
        )
        SELECT 
            NEW.id,
            NEW.deleted_by,
            NEW.deletion_reason,
            to_jsonb(OLD),
            u.email,
            u.name
        FROM users u
        WHERE u.id = NEW.deleted_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically log deletions
CREATE TRIGGER log_event_deletion_trigger
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION log_event_deletion();