# 🚀 Quick Fix Guide - Supabase SQL Editor

## The Error You Got

`ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`

This happens because Supabase SQL Editor wraps everything in a transaction. Here's the fix:

## Option 1: Use Fixed Scripts (Recommended)

I've created fixed versions without `CONCURRENTLY`. They work but will briefly lock tables:

### Script 1: Add Indexes (Fixed Version)

```sql
-- Events table indexes (most important for performance)
CREATE INDEX IF NOT EXISTS idx_events_timestamp_desc 
ON events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_events_country_region 
ON events(country, region);

CREATE INDEX IF NOT EXISTS idx_events_severity_escalation 
ON events(severity, escalation_score DESC);

-- News table indexes
CREATE INDEX IF NOT EXISTS idx_news_published_desc 
ON news(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_processed 
ON news(processed) 
WHERE NOT processed;

-- Conflicts table indexes
CREATE INDEX IF NOT EXISTS idx_conflicts_active_escalation 
ON conflicts(status, escalation_score DESC) 
WHERE status = 'active';

-- Check what was created
SELECT tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
GROUP BY tablename;
```

## Option 2: Run Outside Transaction (Better but Harder)

If you want to use `CONCURRENTLY` (no table locks), you need to:

1. In Supabase SQL Editor, look for **"RUN" button dropdown**
2. Select **"Run without transaction"** if available
3. Or use Supabase CLI/psql directly:

```bash
# Using Supabase CLI
supabase db push --include migrations/001_add_performance_indexes.sql

# Or using psql directly
psql "YOUR_DATABASE_URL" -f migrations/001_add_performance_indexes.sql
```

## Option 3: Create Indexes One by One

Run each CREATE INDEX separately in SQL Editor:

```sql
-- Run each line separately
CREATE INDEX idx_events_timestamp_desc ON events(timestamp DESC);
```

Then:

```sql
CREATE INDEX idx_events_country_region ON events(country, region);
```

And so on...

## Which Option to Choose?

- **During low traffic**: Use Option 1 (fixed scripts)
- **During high traffic**: Use Option 2 or 3 with CONCURRENTLY
- **If unsure**: Option 1 is safe and takes < 1 minute

## After Creating Indexes

Run this to verify:

```sql
-- Count indexes created
SELECT COUNT(*) as total_indexes
FROM pg_indexes
WHERE indexname LIKE 'idx_%';

-- Should see 10+ indexes
```

## Continue With Other Migrations

After indexes are created, run:
- Script 2: Archive unused tables (works as-is)
- Script 3: Fix escalation pipeline (works as-is)

The table lock from indexes is brief (seconds), so Option 1 is usually fine!