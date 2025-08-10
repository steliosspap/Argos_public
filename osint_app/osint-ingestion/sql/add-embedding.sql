-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create index for fast similarity search using IVFFlat
CREATE INDEX IF NOT EXISTS idx_events_embedding 
ON events 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Add translated flag to track translated events
ALTER TABLE events ADD COLUMN IF NOT EXISTS translated BOOLEAN DEFAULT FALSE;

-- Add original_language column to store source language
ALTER TABLE events ADD COLUMN IF NOT EXISTS original_language VARCHAR(10);

-- Create function for semantic similarity search
CREATE OR REPLACE FUNCTION find_similar_events(
    query_embedding vector(768),
    top_k INTEGER DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    event_id UUID,
    similarity_score FLOAT,
    enhanced_headline TEXT,
    location_name TEXT,
    event_timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id AS event_id,
        1 - (embedding <=> query_embedding) AS similarity_score,
        enhanced_headline,
        location_name,
        timestamp AS event_timestamp
    FROM events
    WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) >= similarity_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT top_k;
END;
$$ LANGUAGE plpgsql;

-- Add index on translated column for performance
CREATE INDEX IF NOT EXISTS idx_events_translated ON events(translated);

-- Add index on original_language for filtering
CREATE INDEX IF NOT EXISTS idx_events_original_language ON events(original_language);