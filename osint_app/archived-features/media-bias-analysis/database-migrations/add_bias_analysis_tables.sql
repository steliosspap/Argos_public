-- Create table for storing bias analyses
CREATE TABLE IF NOT EXISTS bias_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_url TEXT UNIQUE NOT NULL,
  article_title TEXT,
  article_source TEXT,
  
  -- Bias analysis results
  overall_bias NUMERIC CHECK (overall_bias >= -5 AND overall_bias <= 5),
  bias_category TEXT CHECK (bias_category IN ('far-left', 'left', 'lean-left', 'center', 'lean-right', 'right', 'far-right')),
  
  -- Detailed bias scores
  political_bias NUMERIC CHECK (political_bias >= -1 AND political_bias <= 1),
  sensationalism_score NUMERIC CHECK (sensationalism_score >= 0 AND sensationalism_score <= 1),
  emotional_language_score NUMERIC CHECK (emotional_language_score >= 0 AND emotional_language_score <= 1),
  source_balance_score NUMERIC CHECK (source_balance_score >= 0 AND source_balance_score <= 1),
  fact_selection_bias NUMERIC CHECK (fact_selection_bias >= -1 AND fact_selection_bias <= 1),
  
  -- Analysis metadata
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  explanation TEXT,
  analysis JSONB, -- Full analysis data including indicators and highlighted phrases
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for fact-checking results
CREATE TABLE IF NOT EXISTS fact_check_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_url TEXT UNIQUE NOT NULL,
  article_title TEXT,
  article_source TEXT,
  
  -- Overall verification results
  overall_verification TEXT CHECK (overall_verification IN ('verified', 'partially-verified', 'disputed', 'unverified')),
  verification_score NUMERIC CHECK (verification_score >= 0 AND verification_score <= 1),
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  summary TEXT,
  
  -- Detailed results
  claims JSONB, -- Array of claim verifications
  corroborating_sources JSONB, -- Array of supporting sources
  conflicting_sources JSONB, -- Array of conflicting sources
  geographic_coverage JSONB, -- Geographic spread of sources
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add bias and fact-check fields to news table (news_with_sources is a view)
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS bias_analysis_id UUID REFERENCES bias_analyses(id),
ADD COLUMN IF NOT EXISTS fact_check_id UUID REFERENCES fact_check_results(id),
ADD COLUMN IF NOT EXISTS bias_score NUMERIC,
ADD COLUMN IF NOT EXISTS verification_status TEXT;

-- Also add to events table for conflict events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS bias_analysis_id UUID REFERENCES bias_analyses(id),
ADD COLUMN IF NOT EXISTS fact_check_id UUID REFERENCES fact_check_results(id),
ADD COLUMN IF NOT EXISTS bias_score NUMERIC,
ADD COLUMN IF NOT EXISTS verification_status TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bias_analyses_url ON bias_analyses(article_url);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_category ON bias_analyses(bias_category);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_created ON bias_analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_fact_check_url ON fact_check_results(article_url);
CREATE INDEX IF NOT EXISTS idx_fact_check_verification ON fact_check_results(overall_verification);
CREATE INDEX IF NOT EXISTS idx_fact_check_created ON fact_check_results(created_at);

-- Add RLS policies
ALTER TABLE bias_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_check_results ENABLE ROW LEVEL SECURITY;

-- Anyone can read bias analyses and fact checks
CREATE POLICY "Public read access for bias analyses" ON bias_analyses
  FOR SELECT USING (true);

CREATE POLICY "Public read access for fact checks" ON fact_check_results
  FOR SELECT USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role write access for bias analyses" ON bias_analyses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role write access for fact checks" ON fact_check_results
  FOR ALL USING (auth.role() = 'service_role');

-- Update the news_with_sources view to include bias and fact-check data
DROP VIEW IF EXISTS news_with_sources;
CREATE VIEW news_with_sources AS
SELECT 
    n.*,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'outlet', ns.outlet,
                'url', ns.source_url,
                'published_at', ns.published_at
            ) ORDER BY ns.added_at
        ) FILTER (WHERE ns.id IS NOT NULL),
        '[]'::jsonb
    ) as sources
FROM news n
LEFT JOIN news_sources ns ON n.id = ns.news_id
GROUP BY n.id, n.title, n.summary, n.url, n.source, n.published_at, n.created_at, 
         n.updated_at, n.country, n.region, n.escalation_score, n.tags, n.content_hash,
         n.primary_source, n.source_count, n.is_multi_source, n.bias_analysis_id, 
         n.fact_check_id, n.bias_score, n.verification_status;