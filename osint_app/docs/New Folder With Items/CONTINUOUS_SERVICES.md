# OSINT Platform Continuous Services

## Overview
The platform now has continuous services that keep data fresh:

1. **Sync Service** - Converts news articles to map events every 5 minutes
2. **RSS Fetch Service** - Fetches fresh RSS feeds every 30 minutes
3. **GitHub Actions** - Runs every 15 minutes for additional ingestion

## Quick Commands

### Start All Services
```bash
./scripts/start-all-services.sh
```

### Stop All Services
```bash
./scripts/stop-all-services.sh
```

### Check Service Status
```bash
./scripts/check-services.sh
```

## Auto-Start on Login (macOS)

To ensure services start automatically:

```bash
# Copy the LaunchAgent
cp com.argos.osint.plist ~/Library/LaunchAgents/

# Load the service
launchctl load ~/Library/LaunchAgents/com.argos.osint.plist

# Check if it's running
launchctl list | grep argos
```

To stop auto-start:
```bash
launchctl unload ~/Library/LaunchAgents/com.argos.osint.plist
rm ~/Library/LaunchAgents/com.argos.osint.plist
```

## Service Details

### Sync Service
- **Purpose**: Converts news articles to events on the map
- **Schedule**: Every 5 minutes
- **Log**: `logs/sync-service.log`
- **Process**: `sync-without-column.js`

### RSS Fetch Service
- **Purpose**: Fetches fresh RSS feeds from various sources
- **Schedule**: Rotates through sources every 5 minutes, full cycle every 30 minutes
- **Log**: `logs/rss-fetch.log`
- **Process**: `continuous-rss-fetch.sh`

### GitHub Actions
- **Purpose**: Large-scale ingestion with translation
- **Schedule**: Every 15 minutes
- **Location**: `.github/workflows/massive-ingestion-optimized.yml`
- **View runs**: https://github.com/bombafrontistiria/argos/actions

## Monitoring

### Check Event Count
```bash
node -e "
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  console.log('Total events:', count);
})();
"
```

### View Recent Events
Check the platform at http://localhost:3000 to see the latest events on the map.

## Troubleshooting

### Services Not Starting
1. Check logs in `logs/` directory
2. Ensure Node.js is installed: `node --version`
3. Check environment variables in `.env.local`

### No New Events
1. Check RSS fetch logs for errors
2. Verify Supabase connection
3. Check GitHub Actions status

### High Memory Usage
The services are designed to be lightweight, but if issues occur:
1. Restart services: `./scripts/stop-all-services.sh && ./scripts/start-all-services.sh`
2. Check for memory leaks in logs
3. Adjust batch sizes in scripts if needed