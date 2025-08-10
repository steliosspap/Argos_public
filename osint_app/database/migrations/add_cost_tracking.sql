-- Create cost tracking tables for internal business metrics

-- Main cost metrics table
CREATE TABLE IF NOT EXISTS cost_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metrics JSONB NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pipeline run costs tracking
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL, -- 'events', 'news', 'arms_deals', 'conflicts'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10, 6),
    error_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT NOT NULL, -- 'openai', 'mapbox', 'news_api', etc.
    endpoint TEXT,
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    response_time_ms INTEGER,
    status_code INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity costs
CREATE TABLE IF NOT EXISTS user_activity_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    activity_type TEXT NOT NULL, -- 'map_load', 'search', 'export', etc.
    resource_usage JSONB DEFAULT '{}'::jsonb,
    estimated_cost DECIMAL(10, 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_pipeline_runs_type ON pipeline_runs(run_type);
CREATE INDEX idx_pipeline_runs_started ON pipeline_runs(started_at DESC);
CREATE INDEX idx_api_usage_service ON api_usage(service);
CREATE INDEX idx_api_usage_created ON api_usage(created_at DESC);
CREATE INDEX idx_user_activity_costs_user ON user_activity_costs(user_id);
CREATE INDEX idx_user_activity_costs_type ON user_activity_costs(activity_type);

-- Create views for cost analysis
CREATE OR REPLACE VIEW daily_cost_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT user_id) as unique_users,
    SUM(CASE WHEN run_type = 'events' THEN 1 ELSE 0 END) as event_pipeline_runs,
    SUM(CASE WHEN run_type = 'news' THEN 1 ELSE 0 END) as news_pipeline_runs,
    SUM(items_processed) as total_items_processed,
    SUM(api_calls_made) as total_api_calls,
    SUM(estimated_cost) as total_pipeline_cost,
    (
        SELECT SUM(cost) 
        FROM api_usage 
        WHERE DATE(api_usage.created_at) = DATE(pipeline_runs.started_at)
    ) as total_api_cost
FROM pipeline_runs
LEFT JOIN user_activity_costs ON DATE(pipeline_runs.started_at) = DATE(user_activity_costs.created_at)
GROUP BY DATE(created_at);

-- Function to calculate cost per user
CREATE OR REPLACE FUNCTION calculate_user_cost(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_cost DECIMAL,
    map_loads INTEGER,
    searches INTEGER,
    api_calls INTEGER,
    data_processed_mb DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(estimated_cost) as total_cost,
        COUNT(CASE WHEN activity_type = 'map_load' THEN 1 END) as map_loads,
        COUNT(CASE WHEN activity_type = 'search' THEN 1 END) as searches,
        SUM((resource_usage->>'api_calls')::INTEGER) as api_calls,
        SUM((resource_usage->>'data_mb')::DECIMAL) as data_processed_mb
    FROM user_activity_costs
    WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$ LANGUAGE plpgsql;

-- Function to track pipeline run costs
CREATE OR REPLACE FUNCTION track_pipeline_cost(
    p_run_type TEXT,
    p_items_processed INTEGER,
    p_api_calls INTEGER DEFAULT 0,
    p_tokens_used INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    v_run_id UUID;
    v_estimated_cost DECIMAL;
BEGIN
    -- Calculate estimated cost based on operation type
    v_estimated_cost := CASE p_run_type
        WHEN 'events' THEN p_items_processed * 0.002 + p_api_calls * 0.001
        WHEN 'news' THEN p_items_processed * 0.001 + p_api_calls * 0.001
        WHEN 'arms_deals' THEN p_items_processed * 0.0005
        WHEN 'conflicts' THEN p_items_processed * 0.003 + p_api_calls * 0.002
        ELSE p_items_processed * 0.001
    END;
    
    -- Add token costs if applicable
    IF p_tokens_used > 0 THEN
        v_estimated_cost := v_estimated_cost + (p_tokens_used / 1000.0 * 0.002);
    END IF;
    
    INSERT INTO pipeline_runs (
        run_type,
        items_processed,
        api_calls_made,
        tokens_used,
        estimated_cost,
        completed_at
    ) VALUES (
        p_run_type,
        p_items_processed,
        p_api_calls,
        p_tokens_used,
        v_estimated_cost,
        NOW()
    ) RETURNING id INTO v_run_id;
    
    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

-- RLS policies (restricted to service role only)
ALTER TABLE cost_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_costs ENABLE ROW LEVEL SECURITY;

-- Only service role can access cost data
CREATE POLICY "Service role only" ON cost_metrics
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Service role only" ON pipeline_runs
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Service role only" ON api_usage
    FOR ALL TO service_role
    USING (true);

CREATE POLICY "Service role only" ON user_activity_costs
    FOR ALL TO service_role
    USING (true);