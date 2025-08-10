-- Archive Unused Tables to Save Storage
-- These tables were created but are not used in the codebase
-- Run this in Supabase SQL Editor

-- Create archive schema for backup
CREATE SCHEMA IF NOT EXISTS archive;

-- Function to safely move tables to archive
CREATE OR REPLACE FUNCTION archive_unused_table(table_name text) 
RETURNS void AS $$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND information_schema.tables.table_name = $1) THEN
        
        -- Move table to archive schema
        EXECUTE format('ALTER TABLE public.%I SET SCHEMA archive', $1);
        
        RAISE NOTICE 'Archived table: %', $1;
    ELSE
        RAISE NOTICE 'Table % does not exist, skipping', $1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Archive unused analytics and cost tracking tables
SELECT archive_unused_table('analytics_events');
SELECT archive_unused_table('analytics_daily_summary');
SELECT archive_unused_table('analytics_popular_events');
SELECT archive_unused_table('pipeline_runs');
SELECT archive_unused_table('api_usage');
SELECT archive_unused_table('user_activity_costs');
SELECT archive_unused_table('cost_metrics');
SELECT archive_unused_table('api_cost_tracking');
SELECT archive_unused_table('model_usage_tracking');
SELECT archive_unused_table('rate_limit_tracking');
SELECT archive_unused_table('user_activity_logs');

-- Show what was archived
SELECT 
    table_schema,
    table_name,
    pg_size_pretty(pg_total_relation_size(table_schema||'.'||table_name)) as size
FROM information_schema.tables
WHERE table_schema = 'archive'
ORDER BY table_name;

-- Calculate space saved
SELECT 
    'Archived ' || COUNT(*) || ' tables' as result,
    pg_size_pretty(SUM(pg_total_relation_size(table_schema||'.'||table_name))) as total_size
FROM information_schema.tables
WHERE table_schema = 'archive';

-- To restore a table if needed:
-- ALTER TABLE archive.table_name SET SCHEMA public;