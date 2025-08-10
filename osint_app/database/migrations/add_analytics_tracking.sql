-- Create analytics events table for tracking user interactions
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    action TEXT NOT NULL,
    label TEXT,
    value NUMERIC,
    metadata JSONB,
    session_id TEXT,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX idx_analytics_events_category_action ON analytics_events(category, action);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);

-- Create a view for daily analytics summary
CREATE VIEW analytics_daily_summary AS
SELECT 
    DATE(timestamp) as date,
    category,
    action,
    COUNT(*) as event_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
GROUP BY DATE(timestamp), category, action;

-- Create a view for popular events
CREATE VIEW analytics_popular_events AS
SELECT 
    category,
    action,
    label,
    COUNT(*) as event_count,
    COUNT(DISTINCT session_id) as unique_sessions
FROM analytics_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY category, action, label
ORDER BY event_count DESC;

-- Add RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert analytics events
CREATE POLICY "Service role can insert analytics events" ON analytics_events
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Authenticated users can view their own analytics
CREATE POLICY "Users can view own analytics" ON analytics_events
    FOR SELECT TO authenticated
    USING (user_id = auth.uid()::text);

-- Function to clean up old analytics data (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_events
    WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;