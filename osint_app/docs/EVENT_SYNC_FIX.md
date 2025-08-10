# Event Sync Fix Documentation

## Problem Summary
The platform was ingesting news articles but they weren't appearing on the map or being used for escalation score calculations. This was because:

1. News articles were being saved to the `news` table
2. But they weren't being converted to map-compatible events in the `events` table
3. The escalation score calculations rely on the `events` table

## Solution Implemented

### 1. Created Event Sync Script
**File**: `scripts/sync-events-to-map.js`

This script:
- Fetches recent news articles from the last 24 hours
- Converts them to events with proper geolocation
- Inserts them into the `events` table for map display
- Updates conflict escalation scores based on new events

### 2. Created Continuous Sync Service
**File**: `scripts/continuous-sync.js`

This service:
- Runs continuously to sync new articles automatically
- Processes unprocessed news in batches
- Listens for real-time news insertions
- Updates escalation scores when new events are added

### 3. Updated Package.json Scripts
Added three new npm scripts:
- `npm run sync-events` - Run manual sync
- `npm run ingest-and-sync` - Ingest news and sync in one command
- `npm run continuous-sync` - Run the continuous sync service

## How to Use

### Manual Sync (One-time)
```bash
# Ingest news and sync to map
npm run ingest-and-sync
```

### Automatic Sync (Recommended)
```bash
# Run continuous sync service
npm run continuous-sync
```

This will:
- Process any unsynced news articles
- Listen for new articles in real-time
- Automatically sync every 5 minutes
- Update escalation scores as needed

### Verify Events on Map
After syncing, you should see:
- New events appearing on the OSINT map at `/osint-map`
- Events displayed in the Intelligence Center at `/intelligence-center`
- Updated escalation scores for affected regions

## Database Changes
Added migration: `database/migrations/add_processed_for_events.sql`
- Adds `processed_for_events` column to track sync status
- Prevents duplicate processing of news articles

## GitHub Actions Integration
The existing workflow at `.github/workflows/massive-ingestion-optimized.yml` already includes:
- News ingestion via `ingest-news.js`
- Event sync via `syncEvents.js`
- Escalation updates via `improvedEscalationUpdate.js`

This runs automatically every 15 minutes.

## Troubleshooting

### Events Not Appearing
1. Check if news articles exist: Look in the `news` table
2. Run manual sync: `npm run sync-events`
3. Check console output for errors

### Escalation Scores Not Updating
1. Ensure conflicts are defined in the `conflicts` table
2. Check that events have matching country/region values
3. Run escalation update manually from the sync script

### Real-time Updates Not Working
1. Check Supabase real-time is enabled for your tables
2. Verify environment variables are set correctly
3. Check browser console for WebSocket errors