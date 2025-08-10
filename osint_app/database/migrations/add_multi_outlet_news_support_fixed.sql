-- Migration: Add multi-outlet support for news deduplication
-- This version handles both INTEGER and UUID id columns in the news table

-- First, check if news_sources table already exists
DO $$
DECLARE
    v_id_type TEXT;
BEGIN
    -- Get the data type of news.id column
    SELECT data_type INTO v_id_type
    FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'id';
    
    -- Drop existing news_sources table if it exists (for clean migration)
    DROP TABLE IF EXISTS news_sources CASCADE;
    
    -- Create the appropriate table based on id type
    IF v_id_type = 'integer' THEN
        -- Create table with integer foreign key
        CREATE TABLE news_sources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            news_id INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
            outlet TEXT NOT NULL,
            source_url TEXT NOT NULL,
            published_at TIMESTAMP WITH TIME ZONE,
            added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(news_id, outlet)
        );
    ELSE
        -- Create table with UUID foreign key
        CREATE TABLE news_sources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
            outlet TEXT NOT NULL,
            source_url TEXT NOT NULL,
            published_at TIMESTAMP WITH TIME ZONE,
            added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(news_id, outlet)
        );
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_sources_news_id ON news_sources(news_id);
CREATE INDEX IF NOT EXISTS idx_news_sources_outlet ON news_sources(outlet);
CREATE INDEX IF NOT EXISTS idx_news_sources_added_at ON news_sources(added_at);

-- Add columns to news table to track primary source (if they don't exist)
DO $$
BEGIN
    -- Add primary_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'news' AND column_name = 'primary_source') THEN
        ALTER TABLE news ADD COLUMN primary_source TEXT;
    END IF;
    
    -- Add source_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'news' AND column_name = 'source_count') THEN
        ALTER TABLE news ADD COLUMN source_count INTEGER DEFAULT 1;
    END IF;
    
    -- Add is_multi_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'news' AND column_name = 'is_multi_source') THEN
        ALTER TABLE news ADD COLUMN is_multi_source BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create function to merge duplicate news articles (handles both ID types)
CREATE OR REPLACE FUNCTION merge_duplicate_news(
    p_existing_id TEXT, -- Accept as TEXT and cast internally
    p_new_article JSONB
) RETURNS TEXT AS $$
DECLARE
    v_outlet TEXT;
    v_source_url TEXT;
    v_published_at TIMESTAMP WITH TIME ZONE;
    v_id_type TEXT;
BEGIN
    -- Extract data from new article
    v_outlet := p_new_article->>'source';
    v_source_url := p_new_article->>'url';
    v_published_at := (p_new_article->>'published_at')::TIMESTAMP WITH TIME ZONE;
    
    -- Get the data type of news.id column
    SELECT data_type INTO v_id_type
    FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'id';
    
    -- Insert based on ID type
    IF v_id_type = 'integer' THEN
        -- Add new source with integer ID
        INSERT INTO news_sources (news_id, outlet, source_url, published_at)
        VALUES (p_existing_id::INTEGER, v_outlet, v_source_url, v_published_at)
        ON CONFLICT (news_id, outlet) DO UPDATE
        SET source_url = EXCLUDED.source_url,
            published_at = LEAST(news_sources.published_at, EXCLUDED.published_at);
        
        -- Update news article with multi-source info
        UPDATE news
        SET 
            source_count = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = p_existing_id::INTEGER),
            is_multi_source = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = p_existing_id::INTEGER) > 1,
            updated_at = NOW()
        WHERE id = p_existing_id::INTEGER;
    ELSE
        -- Add new source with UUID
        INSERT INTO news_sources (news_id, outlet, source_url, published_at)
        VALUES (p_existing_id::UUID, v_outlet, v_source_url, v_published_at)
        ON CONFLICT (news_id, outlet) DO UPDATE
        SET source_url = EXCLUDED.source_url,
            published_at = LEAST(news_sources.published_at, EXCLUDED.published_at);
        
        -- Update news article with multi-source info
        UPDATE news
        SET 
            source_count = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = p_existing_id::UUID),
            is_multi_source = (SELECT COUNT(DISTINCT outlet) FROM news_sources WHERE news_id = p_existing_id::UUID) > 1,
            updated_at = NOW()
        WHERE id = p_existing_id::UUID;
    END IF;
    
    RETURN p_existing_id;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing news to news_sources table
DO $$
DECLARE
    v_id_type TEXT;
BEGIN
    -- Get the data type of news.id column
    SELECT data_type INTO v_id_type
    FROM information_schema.columns
    WHERE table_name = 'news' AND column_name = 'id';
    
    -- Insert based on ID type
    IF v_id_type = 'integer' THEN
        INSERT INTO news_sources (news_id, outlet, source_url, published_at)
        SELECT 
            id::INTEGER as news_id,
            source as outlet,
            url as source_url,
            published_at
        FROM news
        WHERE source IS NOT NULL AND url IS NOT NULL
        ON CONFLICT (news_id, outlet) DO NOTHING;
    ELSE
        INSERT INTO news_sources (news_id, outlet, source_url, published_at)
        SELECT 
            id::UUID as news_id,
            source as outlet,
            url as source_url,
            published_at
        FROM news
        WHERE source IS NOT NULL AND url IS NOT NULL
        ON CONFLICT (news_id, outlet) DO NOTHING;
    END IF;
    
    -- Update source counts
    EXECUTE '
        UPDATE news n
        SET 
            source_count = ns.count,
            is_multi_source = ns.count > 1,
            primary_source = COALESCE(primary_source, source)
        FROM (
            SELECT news_id, COUNT(DISTINCT outlet) as count
            FROM news_sources
            GROUP BY news_id
        ) ns
        WHERE n.id::TEXT = ns.news_id::TEXT
    ';
END $$;

-- Add RLS policies
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" 
ON news_sources FOR SELECT 
USING (true);

-- Create view that works with both ID types
-- Using n.* and only grouping by n.id to avoid listing all columns
CREATE OR REPLACE VIEW news_with_sources AS
WITH news_source_agg AS (
    SELECT 
        news_id,
        jsonb_agg(
            jsonb_build_object(
                'outlet', outlet,
                'url', source_url,
                'published_at', published_at
            ) ORDER BY added_at
        ) as sources
    FROM news_sources
    GROUP BY news_id
)
SELECT 
    n.*,
    COALESCE(nsa.sources, '[]'::jsonb) as sources
FROM news n
LEFT JOIN news_source_agg nsa ON n.id::TEXT = nsa.news_id::TEXT;

-- Add comment explaining the multi-outlet support
COMMENT ON TABLE news_sources IS 'Tracks all news outlets reporting the same story for deduplication and credibility';
COMMENT ON FUNCTION merge_duplicate_news IS 'Merges a new article from a different outlet into an existing news item';

-- Verify migration
SELECT 
    COUNT(*) as total_news,
    COUNT(*) FILTER (WHERE is_multi_source = true) as multi_source_news,
    MAX(source_count) as max_sources
FROM news;