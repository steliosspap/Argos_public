# 🚀 Conflict Sync Setup Guide

Quick setup instructions for implementing the automated conflict intelligence sync system.

## ⚡ Quick Start (5 minutes)

### 1. Update Database Schema
```sql
-- Run in Supabase SQL Editor
-- Copy and paste the entire contents of:
-- database/conflicts-sync-schema.sql
```

### 2. Test the System
```bash
# Safe test (no database changes)
npm run sync-conflicts-dev

# Full test with sample data
npm run sync-conflicts-test

# Production sync
npm run sync-conflicts
```

### 3. Verify Results
- Check Supabase `conflicts` table for new entries
- Visit homepage to see conflicts on map
- Check `conflict_sync_log` table for operation logs

## 🎯 Expected Behavior

### After Running `npm run sync-conflicts-test`:
1. **5 test articles** created in `news` table
2. **3-5 conflicts** detected and created in `conflicts` table
3. **New markers** appear on homepage map
4. **Sync logs** recorded in `conflict_sync_log` table

### Test Articles Created:
- Gaza Conflict (Escalation: 9) → Red marker in Middle East
- Ukraine War (Escalation: 8) → Red marker in Europe  
- Sudan Crisis (Escalation: 7) → Orange marker in Africa
- Myanmar Strikes (Escalation: 6) → Orange marker in Asia
- Kashmir Tensions (Escalation: 5) → Yellow marker in Asia

## 🔄 Automation Options

### Option 1: GitHub Actions (Recommended)
Create `.github/workflows/sync-conflicts.yml`:
```yaml
name: Sync Conflicts
on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run sync-conflicts
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

### Option 2: Server Cron Job
```bash
# Add to server crontab
*/30 * * * * cd /path/to/mercenary && npm run sync-conflicts
```

## 🐛 Troubleshooting

### No Conflicts Created?
- Check if news articles exist with `escalation_score >= 4`
- Verify articles are within last 12 hours
- Run with `--test` flag to create sample data

### Database Errors?
- Ensure Supabase credentials are correct in `.env.local`
- Verify schema update script ran successfully
- Check RLS policies allow inserts/updates

### Map Not Updating?
- Refresh homepage after running sync
- Check browser console for errors
- Verify conflicts have valid latitude/longitude

## 📊 Monitoring

### Check Sync Logs
```sql
-- View recent sync operations
SELECT * FROM conflict_sync_log 
ORDER BY created_at DESC 
LIMIT 10;
```

### Monitor Conflict Creation
```sql
-- View auto-generated conflicts
SELECT name, country, escalation_score, updated_at
FROM conflicts 
WHERE auto_generated = true
ORDER BY updated_at DESC;
```

## ✅ Success Criteria

After setup, you should have:
- ✅ Real-time conflict detection from news
- ✅ Automated map updates without manual input
- ✅ Geographic intelligence with 60+ countries
- ✅ Escalation tracking with 1-10 scoring
- ✅ Auto-expiration of inactive conflicts
- ✅ Comprehensive logging and monitoring

---

**🎉 Your Mercenary platform is now a fully automated global conflict intelligence system!**