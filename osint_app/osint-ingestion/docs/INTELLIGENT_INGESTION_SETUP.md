# ARGOS Intelligent Ingestion Setup Guide

This guide covers setting up automated runs of the intelligent ingestion system that uses Google Custom Search + GPT-4o.

## Quick Setup (macOS/Linux)

### Option 1: Cron Job (Recommended)

1. **Run the setup script:**
   ```bash
   cd /path/to/argos/osint_app/osint-ingestion
   ./setup-cron.sh
   ```

2. **Verify it's working:**
   ```bash
   # Check if cron job was added
   crontab -l
   
   # Test run manually
   ./cron-ingestion.sh
   
   # Check logs
   tail -f logs/ingestion-$(date +%Y%m%d).log
   ```

### Option 2: Systemd Service (Linux only)

1. **Copy service files:**
   ```bash
   # Update the path in the service file first
   sed -i 's|/path/to/argos|/your/actual/path|g' argos-ingestion.service
   
   # Copy to systemd
   sudo cp argos-ingestion.service /etc/systemd/system/
   sudo cp argos-ingestion.timer /etc/systemd/system/
   ```

2. **Enable and start:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable argos-ingestion.timer
   sudo systemctl start argos-ingestion.timer
   ```

3. **Check status:**
   ```bash
   sudo systemctl status argos-ingestion.timer
   sudo journalctl -u argos-ingestion -f
   ```

## How It Works

The intelligent ingestion runs every 30 minutes and:

1. **Searches** for conflict news using Google Custom Search API
2. **Analyzes** each article with GPT-4o to determine if it's conflict-related
3. **Extracts** structured data (location, actors, severity, etc.)
4. **Stores** valid events in the database with deduplication

## Monitoring

### View Logs

**Cron logs:**
```bash
tail -f osint_app/osint-ingestion/logs/ingestion-*.log
```

**Systemd logs:**
```bash
sudo journalctl -u argos-ingestion -f
```

### Check Database

```sql
-- Recent ingested events
SELECT id, title, country, severity, created_at 
FROM events 
WHERE source_type = 'intelligent_search'
ORDER BY created_at DESC 
LIMIT 10;

-- Events by country
SELECT country, COUNT(*) as event_count 
FROM events 
WHERE source_type = 'intelligent_search'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY country 
ORDER BY event_count DESC;
```

## Troubleshooting

### Cron not running?
```bash
# Check if cron service is running
service cron status  # or: systemctl status crond

# Check cron logs
grep CRON /var/log/syslog  # Ubuntu/Debian
grep CRON /var/log/cron    # CentOS/RHEL

# Test script manually
cd osint_app/osint-ingestion
./cron-ingestion.sh
```

### API Errors?
```bash
# Test APIs individually
node intelligent-ingestion.js test-search
node intelligent-ingestion.js test-gpt

# Check environment variables
node -e "console.log(process.env.GOOGLE_API_KEY ? 'Google API key found' : 'Missing Google API key')"
node -e "console.log(process.env.OPENAI_API_KEY ? 'OpenAI API key found' : 'Missing OpenAI API key')"
```

### Database Issues?
```bash
# Test database connection
node -e "import('./intelligent-ingestion.js').then(() => console.log('DB connection OK'))"

# Run SQL migration if needed
psql $DATABASE_URL < migrations/add_missing_columns.sql
```

## Customization

### Adjust Frequency
Edit crontab to change timing:
```bash
crontab -e

# Examples:
*/15 * * * *   # Every 15 minutes
0 * * * *      # Every hour
*/5 * * * *    # Every 5 minutes (for testing)
```

### Modify Search Queries
Edit `CONFIG.searchQueries` in `intelligent-ingestion.js` to focus on specific regions or conflict types.

### Change Processing Limits
```bash
# Process more articles per run
./cron-ingestion.sh --limit 100

# Or edit cron-ingestion.sh to change default
```

## Performance

- Each run processes ~50 articles by default
- Takes 2-5 minutes depending on API response times
- Costs approximately $0.05-0.10 per run in API fees
- Deduplication prevents storing duplicate events

## Security Notes

- API keys are loaded from environment files
- Logs don't contain sensitive data
- Old logs are automatically rotated after 7 days
- Database writes use parameterized queries