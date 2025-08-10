# Database Schema Deployment Guide

## 🚨 Manual Database Migration Required

The News Ingestion Agent has successfully enhanced the pipeline with escalation scoring functionality, but the database schema update requires manual deployment via Supabase dashboard for security compliance.

## Current Status
- ✅ News pipeline enhanced with escalation scoring
- ✅ Migration SQL file created: `news-table-escalation-update.sql`
- ⚠️ **PENDING**: Manual schema deployment in Supabase

## Manual Deployment Steps

### Step 1: Access Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to your project
3. Go to **Database** → **SQL Editor**

### Step 2: Execute Schema Migration
Copy and paste the following SQL commands in the SQL Editor:

```sql
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
```

### Step 3: Verify Migration
Run the verification script to confirm the migration was successful:

```bash
node scripts/test-escalation-column.js
```

Expected output:
```
✅ escalation_score column exists and is accessible
✅ Escalation score update successful
```

## Post-Deployment Tasks

### 1. Enable Enhanced Ingestion
Once the schema is deployed, the enhanced news ingestion pipeline will automatically:
- Calculate escalation scores for all new articles (0-10 scale)
- Persist scores to the database
- Provide analytics via the new views

### 2. Verify Analytics Views
Test the new analytics capabilities:

```sql
-- Check high-escalation articles
SELECT * FROM high_escalation_news LIMIT 10;

-- View escalation analytics by region
SELECT * FROM news_escalation_analytics;
```

### 3. Monitor Performance
- Check database performance after adding new indexes
- Monitor escalation scoring accuracy
- Verify RSS ingestion continues operating normally

## Rollback Plan (If Needed)

If issues occur, you can rollback the changes:

```sql
-- Remove the escalation_score column
ALTER TABLE news DROP COLUMN IF EXISTS escalation_score;

-- Drop the indexes
DROP INDEX IF EXISTS idx_news_escalation_score;
DROP INDEX IF EXISTS idx_news_escalation_region;
DROP INDEX IF EXISTS idx_news_escalation_date;

-- Drop the views
DROP VIEW IF EXISTS high_escalation_news;
DROP VIEW IF EXISTS news_escalation_analytics;
```

## Next Steps After Deployment
1. ✅ Mark schema migration as completed
2. 🔄 Resume normal RSS ingestion with escalation scoring
3. 📊 Begin collecting escalation analytics
4. 🎯 Configure alerting for high-escalation events (score >= 8)

---

**Agent Coordination Note**: This deployment completes the escalation scoring enhancement initiated by the News Ingestion Agent and Backend Agent collaboration.