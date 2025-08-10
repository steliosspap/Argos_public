-- Migration: Add multi-outlet support for news deduplication
-- This allows tracking multiple sources reporting the same story

-- Create a news_sources table to track all sources for each news item
CREATE TABLE IF NOT EXISTS news_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    outlet TEXT NOT NULL,
    source_url TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(news_id, outlet)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_sources_news_id ON news_sources(news_id);
CREATE INDEX IF NOT EXISTS idx_news_sources_outlet ON news_sources(outlet);
CREATE INDEX IF NOT EXISTS idx_news_sources_added_at ON news_sources(added_at);

-- Add column to news table to track primary source
ALTER TABLE news
ADD COLUMN IF NOT EXISTS primary_source TEXT,
ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_multi_source BOOLEAN DEFAULT FALSE;

-- Create function to merge duplicate news articles
CREATE OR REPLACE FUNCTION merge_duplicate_news(
    p_existing_id UUID,
    p_new_article JSONB
) RETURNS UUID AS $$
DECLARE
    v_outlet TEXT;
    v_source_url TEXT;
    v_published_at TIMESTAMP WITH TIME ZONE;
    v_existing_count INTEGER;
BEGIN
    -- Extract data from new article
    v_outlet := p_new_article->>'source';
    v_source_url := p_new_article->>'url';
    v_published_at := (p_new_article->>'published_at')::TIMESTAMP WITH TIME ZONE;
    
    -- Add new source if not already exists
    INSERT INTO news_sources (news_id, outlet, source_url, published_at)
    VALUES (p_existing_id, v_outlet, v_source_url, v_published_at)
    ON CONFLICT (news_id, outlet) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        published_at = LEAST(news_sources.published_at, EXCLUDED.published_at);
    
    -- Update news article with multi-source info
    UPDATE news
    SET 
        source_count = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = p_existing_id),
        is_multi_source = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = p_existing_id) > 1,
        updated_at = NOW()
    WHERE id = p_existing_id;
    
    RETURN p_existing_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for multi-source news with all outlets
CREATE OR REPLACE VIEW news_with_sources AS
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
GROUP BY n.id;

-- Migrate existing news to news_sources table
INSERT INTO news_sources (news_id, outlet, source_url, published_at)
SELECT 
    id as news_id,
    source as outlet,
    url as source_url,
    published_at
FROM news
WHERE NOT EXISTS (
    SELECT 1 FROM news_sources 
    WHERE news_sources.news_id = news.id 
    AND news_sources.outlet = news.source
)
ON CONFLICT (news_id, outlet) DO NOTHING;

-- Update source counts
UPDATE news
SET 
    source_count = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = news.id),
    is_multi_source = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = news.id) > 1,
    primary_source = source
WHERE source_count IS NULL OR source_count = 0;

-- Add RLS policies
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON news_sources FOR SELECT 
USING (true);

-- Create function to get news with merged sources
CREATE OR REPLACE FUNCTION get_deduplicated_news(
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0,
    p_min_sources INTEGER DEFAULT 1
) RETURNS TABLE (
    id UUID,
    title TEXT,
    summary TEXT,
    primary_source TEXT,
    source_count INTEGER,
    sources JSONB,
    published_at TIMESTAMP WITH TIME ZONE,
    country TEXT,
    escalation_score INTEGER,
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.summary,
        n.primary_source,
        n.source_count,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'outlet', ns.outlet,
                    'url', ns.source_url
                ) ORDER BY ns.added_at
            ) FILTER (WHERE ns.id IS NOT NULL),
            '[]'::jsonb
        ) as sources,
        n.published_at,
        n.country,
        n.escalation_score,
        n.tags
    FROM news n
    LEFT JOIN news_sources ns ON n.id = ns.news_id
    WHERE n.source_count >= p_min_sources
    GROUP BY n.id
    ORDER BY n.published_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the multi-outlet support
COMMENT ON TABLE news_sources IS 'Tracks all news outlets reporting the same story for deduplication and credibility';
COMMENT ON FUNCTION merge_duplicate_news IS 'Merges a new article from a different outlet into an existing news item';

-- Verify migration
SELECT 
    COUNT(*) as total_news,
    COUNT(*) FILTER (WHERE is_multi_source = true) as multi_source_news,
    MAX(source_count) as max_sources
FROM news;