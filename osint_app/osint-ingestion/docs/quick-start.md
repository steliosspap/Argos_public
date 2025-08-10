# OSINT Pipeline Quick Start Guide

## ✅ Installation Complete!

Your OSINT conflict event pipeline is now ready to use. Here's how to get started:

## Basic Commands

### 1. Run a Test Ingestion (Dry Run)
```bash
./cli.js ingest --dry-run --verbose --limit 10
```
This will fetch and analyze 10 articles without saving to the database.

### 2. Run Full Ingestion
```bash
./cli.js ingest --verbose
```
This will run a full ingestion cycle and save events to your Supabase database.

### 3. Query Recent Events
```bash
# Show high-severity events from Ukraine in the last 24 hours
./cli.js events --country Ukraine --severity high --days 1

# Show all events from the last week
./cli.js events --days 7 --limit 20
```

### 4. Monitor Mode (Continuous)
```bash
# Run ingestion every 15 minutes with alerts
./cli.js monitor --interval 15 --alerts
```

### 5. Check Sources
```bash
# List all news sources
./cli.js sources --list

# Show source statistics
./cli.js sources --stats
```

## Integration with Next.js App

The pipeline is designed to work with your existing Next.js application:

1. **Database**: Uses the same Supabase instance and tables
2. **Events Table**: Stores extracted events with enhanced data
3. **News Sources**: Uses the existing `news_sources` table
4. **Real-time Updates**: Events appear immediately in your web UI

## Key Features Working

✅ **Multi-Source Ingestion**
- Google Custom Search API (200 queries)
- RSS feeds from major news outlets
- News API integration

✅ **AI-Powered Analysis**
- GPT-4o for event extraction
- Automatic headline enhancement
- Severity and escalation scoring

✅ **Event Detection**
- Casualty extraction
- Location resolution
- Temporal analysis
- Actor identification

✅ **Critical Alerts**
- Automatic detection of high-severity events
- Escalation scoring (1-10 scale)
- Source corroboration

## Common Tasks

### Run Ingestion on Schedule
Add to crontab:
```bash
# Run every hour
0 * * * * cd /path/to/osint-ingestion/src && ./cli.js ingest >> ingestion.log 2>&1
```

### Check System Health
```bash
node test-setup.js
```

### View Logs
```bash
# If using monitor mode, logs appear in console
# For background runs, check ingestion.log
```

## Troubleshooting

1. **OpenAI Errors**: The API sometimes returns malformed JSON. This is handled gracefully.
2. **RSS 406 Error**: Some RSS feeds block automated access. This is normal.
3. **Rate Limits**: Google Search API has daily limits. Monitor usage.

## Next Steps

1. **Set up monitoring** to run ingestion regularly
2. **Configure alerts** to send critical events to Slack/email
3. **Tune thresholds** in `src/core/config.js` for your needs
4. **Add more sources** by updating source configurations

## Support

- Check logs for detailed error information
- Adjust `--limit` parameter to control processing volume
- Use `--dry-run` to test without affecting database
- Set `--verbose` for detailed output

The system is now actively monitoring global conflicts and extracting structured intelligence!