-- Create event_versions table for tracking changes
CREATE TABLE IF NOT EXISTS event_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  version INT NOT NULL,
  changes JSONB NOT NULL,
  changed_by VARCHAR(255) DEFAULT 'system',
  change_reason VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_event_versions_event_id ON event_versions(event_id);
CREATE INDEX idx_event_versions_created_at ON event_versions(created_at DESC);

-- Create trigger function to automatically version events
CREATE OR REPLACE FUNCTION create_event_version() RETURNS TRIGGER AS $$
DECLARE
  changes JSONB;
  version_num INT;
BEGIN
  -- Only create version if there are actual changes
  IF OLD IS DISTINCT FROM NEW THEN
    -- Calculate what changed
    changes := jsonb_build_object();
    
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      changes := changes || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
    END IF;
    
    IF OLD.summary IS DISTINCT FROM NEW.summary THEN
      changes := changes || jsonb_build_object('summary', jsonb_build_object('old', OLD.summary, 'new', NEW.summary));
    END IF;
    
    IF OLD.severity IS DISTINCT FROM NEW.severity THEN
      changes := changes || jsonb_build_object('severity', jsonb_build_object('old', OLD.severity, 'new', NEW.severity));
    END IF;
    
    IF OLD.reliability IS DISTINCT FROM NEW.reliability THEN
      changes := changes || jsonb_build_object('reliability', jsonb_build_object('old', OLD.reliability, 'new', NEW.reliability));
    END IF;
    
    IF OLD.latitude IS DISTINCT FROM NEW.latitude OR OLD.longitude IS DISTINCT FROM NEW.longitude THEN
      changes := changes || jsonb_build_object('coordinates', jsonb_build_object(
        'old', jsonb_build_object('lat', OLD.latitude, 'lng', OLD.longitude),
        'new', jsonb_build_object('lat', NEW.latitude, 'lng', NEW.longitude)
      ));
    END IF;
    
    -- Get the next version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO version_num
    FROM event_versions
    WHERE event_id = NEW.id;
    
    -- Insert version record
    INSERT INTO event_versions (event_id, version, changes)
    VALUES (NEW.id, version_num, changes);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for event updates
CREATE TRIGGER event_version_trigger
AFTER UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION create_event_version();

-- Add version tracking columns to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to get event history
CREATE OR REPLACE FUNCTION get_event_history(p_event_id UUID)
RETURNS TABLE (
  version INT,
  changes JSONB,
  changed_by VARCHAR(255),
  change_reason VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ev.version,
    ev.changes,
    ev.changed_by,
    ev.change_reason,
    ev.created_at
  FROM event_versions ev
  WHERE ev.event_id = p_event_id
  ORDER BY ev.version DESC;
END;
$$ LANGUAGE plpgsql;

-- Create view for latest event versions
CREATE OR REPLACE VIEW event_latest_versions AS
SELECT 
  e.*,
  (SELECT COUNT(*) FROM event_versions WHERE event_id = e.id) as total_versions,
  (SELECT created_at FROM event_versions WHERE event_id = e.id ORDER BY version DESC LIMIT 1) as last_version_date
FROM events e;