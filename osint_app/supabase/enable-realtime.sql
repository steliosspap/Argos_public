-- Enable realtime for the events table
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Create an index on content_hash for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_events_content_hash ON events(content_hash);

-- Create an index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

-- Create an index on channel for filtering
CREATE INDEX IF NOT EXISTS idx_events_channel ON events(channel);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.events TO anon, authenticated;

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policies for read access
CREATE POLICY "Events are viewable by everyone" ON events
  FOR SELECT USING (true);

-- Create policy for authenticated users to insert
CREATE POLICY "Authenticated users can insert events" ON events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Create policy for service role to do everything
CREATE POLICY "Service role can do everything" ON events
  FOR ALL TO service_role USING (true);

-- Notify channel when new events are inserted
CREATE OR REPLACE FUNCTION notify_new_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('new_event', json_build_object(
    'id', NEW.id,
    'title', NEW.title,
    'country', NEW.country,
    'severity', NEW.severity,
    'timestamp', NEW.timestamp
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for notifications
DROP TRIGGER IF EXISTS new_event_trigger ON events;
CREATE TRIGGER new_event_trigger
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_event();