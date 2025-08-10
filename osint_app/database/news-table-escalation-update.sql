-- Add escalation_score column to news table
-- Backend API Agent - Schema Update for News Ingestion Agent

-- Add escalation_score column (0-10 scale)
ALTER TABLE news 
ADD COLUMN IF NOT EXISTS escalation_score DECIMAL(3,1) 
CHECK (escalation_score >= 0 AND escalation_score <= 10);

-- Add index for escalation_score queries
CREATE INDEX IF NOT EXISTS idx_news_escalation_score 
ON news(escalation_score DESC);

-- Add composite index for escalation + region filtering
CREATE INDEX IF NOT EXISTS idx_news_escalation_region 
ON news(region, escalation_score DESC) 
WHERE escalation_score IS NOT NULL;

-- Add composite index for escalation + date filtering
CREATE INDEX IF NOT EXISTS idx_news_escalation_date 
ON news(created_at DESC, escalation_score DESC) 
WHERE escalation_score IS NOT NULL;

-- Update table comment
COMMENT ON COLUMN news.escalation_score IS 
'AI-computed escalation score (0-10): 0=peaceful, 5=medium tension, 8+=critical threat level';

-- Create view for high-escalation news (score >= 6)
CREATE OR REPLACE VIEW high_escalation_news AS
SELECT 
    id,
    title,
    url,
    source,
    content,
    published_at,
    region,
    country,
    escalation_score,
    ai_summary,
    tags,
    created_at,
    updated_at
FROM news 
WHERE escalation_score >= 6
ORDER BY escalation_score DESC, created_at DESC;

-- Create view for escalation analytics
CREATE OR REPLACE VIEW news_escalation_analytics AS
SELECT 
    region,
    country,
    COUNT(*) as article_count,
    AVG(escalation_score) as avg_escalation,
    MAX(escalation_score) as max_escalation,
    COUNT(CASE WHEN escalation_score >= 8 THEN 1 END) as critical_count,
    COUNT(CASE WHEN escalation_score >= 6 THEN 1 END) as high_count,
    COUNT(CASE WHEN escalation_score >= 4 THEN 1 END) as medium_count,
    MAX(created_at) as latest_update
FROM news 
WHERE escalation_score IS NOT NULL
GROUP BY region, country
ORDER BY avg_escalation DESC, article_count DESC;