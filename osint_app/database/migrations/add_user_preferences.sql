-- Create user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    regions TEXT[] DEFAULT '{}',
    event_types TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    severity_threshold INTEGER DEFAULT 5 CHECK (severity_threshold >= 1 AND severity_threshold <= 10),
    notification_settings JSONB DEFAULT '{
        "emailAlerts": false,
        "criticalOnly": false,
        "dailyDigest": false
    }'::jsonb,
    display_settings JSONB DEFAULT '{
        "autoRefresh": true,
        "refreshInterval": 60,
        "defaultView": "map"
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_regions ON user_preferences USING GIN(regions);
CREATE INDEX idx_user_preferences_event_types ON user_preferences USING GIN(event_types);
CREATE INDEX idx_user_preferences_interests ON user_preferences USING GIN(interests);

-- Add RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Create function to automatically create user preferences on user signup
CREATE OR REPLACE FUNCTION create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create preferences for new users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_preferences();

-- Function to get personalized events based on user preferences
CREATE OR REPLACE FUNCTION get_personalized_events(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    summary TEXT,
    country TEXT,
    region TEXT,
    escalation_score DECIMAL,
    event_type TEXT,
    tags TEXT[],
    relevance_score DECIMAL
) AS $$
DECLARE
    v_preferences RECORD;
BEGIN
    -- Get user preferences
    SELECT * INTO v_preferences
    FROM user_preferences
    WHERE user_id = p_user_id;
    
    -- If no preferences found, return latest events
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            e.id,
            e.title,
            e.summary,
            e.country,
            e.region,
            e.escalation_score,
            e.event_type,
            e.tags,
            1.0 AS relevance_score
        FROM events e
        WHERE e.escalation_score >= 5
        ORDER BY e.created_at DESC
        LIMIT p_limit;
        RETURN;
    END IF;
    
    -- Return personalized events based on preferences
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.summary,
        e.country,
        e.region,
        e.escalation_score,
        e.event_type,
        e.tags,
        CASE
            -- Higher score for matching regions
            WHEN e.region = ANY(v_preferences.regions) THEN 2.0
            -- Higher score for matching event types
            WHEN e.event_type = ANY(v_preferences.event_types) THEN 1.8
            -- Higher score for matching interests in tags
            WHEN e.tags && v_preferences.interests THEN 1.5
            -- Base score
            ELSE 1.0
        END AS relevance_score
    FROM events e
    WHERE e.escalation_score >= v_preferences.severity_threshold
    ORDER BY relevance_score DESC, e.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;