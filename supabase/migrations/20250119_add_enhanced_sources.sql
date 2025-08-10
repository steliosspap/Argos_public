-- Add enhanced sources table for ingestion tracking
CREATE TABLE IF NOT EXISTS public.sources (
    source_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    outlet_name VARCHAR(200) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- news_api, rss, social, web_scrape
    language VARCHAR(10) NOT NULL,
    country VARCHAR(100),
    region VARCHAR(100),
    
    -- URLs and access
    base_url TEXT,
    rss_url TEXT,
    api_endpoint TEXT,
    access_method VARCHAR(50), -- api, rss, scrape
    
    -- Reliability metrics
    overall_reliability DECIMAL(3,2) DEFAULT 0.5,
    factual_reporting_score DECIMAL(3,2) DEFAULT 0.5,
    bias_score DECIMAL(3,2) DEFAULT 0.0, -- -1 (left) to 1 (right)
    transparency_score DECIMAL(3,2) DEFAULT 0.5,
    
    -- Performance metrics
    historical_accuracy DECIMAL(3,2) DEFAULT 0.5,
    speed_vs_accuracy DECIMAL(3,2) DEFAULT 0.5,
    update_frequency INTEGER, -- Articles per day
    
    -- Geographic expertise
    geographic_expertise JSONB, -- {"ukraine": 0.9, "middle_east": 0.3}
    conflict_expertise DECIMAL(3,2) DEFAULT 0.5,
    
    -- Access and technical details
    rate_limit INTEGER, -- Requests per hour
    rate_limit_window INTEGER, -- Window in seconds
    last_accessed TIMESTAMP WITH TIME ZONE,
    access_count_today INTEGER DEFAULT 0,
    
    -- Status and health
    is_active BOOLEAN DEFAULT true,
    last_successful_fetch TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,
    health_score DECIMAL(3,2) DEFAULT 1.0,
    
    -- Content characteristics
    typical_content_length INTEGER,
    content_categories TEXT[],
    supported_languages TEXT[],
    
    -- Metadata
    added_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_evaluated TIMESTAMP WITH TIME ZONE,
    evaluation_version VARCHAR(20),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(source_type);
CREATE INDEX IF NOT EXISTS idx_sources_outlet ON sources(outlet_name);
CREATE INDEX IF NOT EXISTS idx_sources_reliability ON sources(overall_reliability DESC);

-- Add RLS policies
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read sources" ON sources
    FOR SELECT
    USING (true);

-- Only authenticated users can modify
CREATE POLICY "Authenticated users can modify sources" ON sources
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Add author profiles table
CREATE TABLE IF NOT EXISTS public.author_profiles (
    author_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    source_id VARCHAR(64) REFERENCES sources(source_id),
    political_lean DECIMAL(3,2),
    expertise_areas TEXT[],
    credibility_score DECIMAL(3,2),
    article_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on author name
CREATE INDEX IF NOT EXISTS idx_author_name ON author_profiles(name);
CREATE INDEX IF NOT EXISTS idx_author_source ON author_profiles(source_id);

-- Enable RLS
ALTER TABLE author_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read author profiles" ON author_profiles
    FOR SELECT
    USING (true);

-- Add fact comparisons table for cross-source verification
CREATE TABLE IF NOT EXISTS public.fact_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100),
    fact_triple JSONB, -- {subject, predicate, object}
    sources_agree INTEGER DEFAULT 0,
    sources_disagree INTEGER DEFAULT 0,
    sources_silent INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2),
    disagreement_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fact_event ON fact_comparisons(event_id);
CREATE INDEX IF NOT EXISTS idx_fact_confidence ON fact_comparisons(confidence_score DESC);

-- Enable RLS
ALTER TABLE fact_comparisons ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read fact comparisons" ON fact_comparisons
    FOR SELECT
    USING (true);

-- Add search queries tracking table
CREATE TABLE IF NOT EXISTS public.search_queries_executed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    conflict_id VARCHAR(100),
    query_type VARCHAR(50), -- broad, targeted, refined
    query_round INTEGER DEFAULT 1, -- 1 or 2
    results_count INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_search_conflict ON search_queries_executed(conflict_id);
CREATE INDEX IF NOT EXISTS idx_search_executed ON search_queries_executed(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_type ON search_queries_executed(query_type);

-- Enable RLS
ALTER TABLE search_queries_executed ENABLE ROW LEVEL SECURITY;

-- Public read, authenticated write
CREATE POLICY "Public can read search queries" ON search_queries_executed
    FOR SELECT
    USING (true);

CREATE POLICY "Service role can write search queries" ON search_queries_executed
    FOR INSERT
    WITH CHECK (true);

-- Add conflict events external tracking
CREATE TABLE IF NOT EXISTS public.conflict_events_external (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) UNIQUE,
    name VARCHAR(500) NOT NULL,
    conflict_type VARCHAR(100),
    regions JSONB,
    key_actors JSONB,
    search_terms JSONB,
    status VARCHAR(50),
    start_date DATE,
    end_date DATE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(100), -- ACLED, Global Conflict Tracker, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conflict_external_id ON conflict_events_external(external_id);
CREATE INDEX IF NOT EXISTS idx_conflict_status ON conflict_events_external(status);
CREATE INDEX IF NOT EXISTS idx_conflict_source ON conflict_events_external(source);

-- Enable RLS
ALTER TABLE conflict_events_external ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read external conflicts" ON conflict_events_external
    FOR SELECT
    USING (true);

-- Insert some default trusted sources
INSERT INTO sources (source_id, name, outlet_name, source_type, language, country, overall_reliability, factual_reporting_score, is_active)
VALUES 
    ('reuters_main', 'Reuters Main Feed', 'Reuters', 'news_api', 'en', 'UK', 0.95, 0.95, true),
    ('bbc_world', 'BBC World News', 'BBC', 'rss', 'en', 'UK', 0.90, 0.90, true),
    ('aljazeera_en', 'Al Jazeera English', 'Al Jazeera', 'rss', 'en', 'Qatar', 0.85, 0.85, true),
    ('ap_news', 'Associated Press', 'AP News', 'news_api', 'en', 'USA', 0.95, 0.95, true),
    ('cnn_world', 'CNN World', 'CNN', 'rss', 'en', 'USA', 0.80, 0.80, true)
ON CONFLICT (source_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE sources IS 'News and information sources with reliability tracking';
COMMENT ON TABLE author_profiles IS 'Individual authors/journalists with credibility tracking';
COMMENT ON TABLE fact_comparisons IS 'Cross-source fact verification results';
COMMENT ON TABLE search_queries_executed IS 'Track all search queries for optimization';
COMMENT ON TABLE conflict_events_external IS 'External conflict tracking sources like ACLED';