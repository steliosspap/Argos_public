-- QUICK FIX: Just the essential columns needed to run the pipeline
-- Run this in Supabase SQL Editor

-- Fix events table (minimum required)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS admin_level_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2) DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS source_count INTEGER DEFAULT 1;

-- Fix news_sources table (minimum required)
ALTER TABLE news_sources 
ADD COLUMN IF NOT EXISTS bias_score DECIMAL(3,2) DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;