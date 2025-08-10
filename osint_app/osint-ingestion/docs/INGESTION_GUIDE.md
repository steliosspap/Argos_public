# ARGOS OSINT Ingestion System Guide

## Overview

The ARGOS platform uses two distinct data ingestion pipelines:
1. **Historical Data**: ACLED conflict datasets (one-time import)
2. **Real-time Data**: RSS news feeds (continuous updates)

## 1. ACLED Historical Data Processing

### Purpose
- Provides historical conflict data from 2022-2025
- Used for timeline analysis and historical context
- Static data that doesn't change

### How to Process

```bash
# Navigate to ingestion directory
cd osint_app/osint-ingestion

# Test with small sample
node acled-processor.js --dry-run --verbose --limit 100

# Full import (will take ~30-60 minutes for 1.5M+ records)
node acled-processor.js --verbose

# Import with limit
node acled-processor.js --limit 50000
```

### Data Processing Steps

1. **Reads CSV files** from `dataset argos/` directory
2. **Filters** to keep only military/conflict events
3. **Calculates scores**:
   - Escalation: Based on event type + fatalities
   - Severity: Maps to critical/high/medium/low
4. **Extracts metadata**:
   - Precise coordinates (lat/lng)
   - Multi-level location (country → region → city)
   - Actors involved
   - Civilian targeting flags
5. **Stores in database** with:
   - `is_historical: true`
   - `data_source: 'acled_import'`
   - 95% reliability score

### Event Types Processed
- Battles → severity: "high"
- Violence against civilians → severity: "critical"
- Explosions/Remote violence → severity: "high"
- Riots → severity: "medium"
- Protests → severity: "low"
- Strategic developments → severity: "low"

## 2. Real-time RSS News Ingestion

### Purpose
- Provides current conflict updates for the live event map
- Runs every 30 minutes via GitHub Actions
- Filters global news for military/conflict content

### Manual Testing

```bash
# Test with high-priority sources
node ingestion.js --dry-run --high-priority --limit 10

# Test specific category
node ingestion.js --dry-run --category defense_intelligence --limit 5

# List available categories
node ingestion.js categories

# Test RSS feed connections
node ingestion.js test --limit 10
```

### Automated via GitHub Actions

The workflow runs automatically every 30 minutes:
```yaml
name: OSINT Ingestion Pipeline v2
on:
  schedule:
    - cron: '*/30 * * * *'
```

### Processing Algorithm

1. **Source Selection**:
   - 400+ RSS feeds from 19 categories
   - High-priority: defense, conflict monitoring, regional sources
   - Processes up to 50 sources per run

2. **Content Filtering**:
   - **Relevance scoring**: Searches for military keywords
   - **Exclusion patterns**: Removes sports, entertainment, animals
   - **Minimum threshold**: 0.2 relevance score

3. **Conflict Detection**:
   - AI-powered classification
   - Categories: direct conflict, indirect, reporting, non-military
   - Only ingests military/geopolitical events

4. **Location Extraction**:
   - Attempts to extract coordinates from text
   - Falls back to country/region detection
   - Verifies extracted locations

5. **Storage**:
   - News table: All relevant articles
   - Events table: High-relevance (≥0.5) with location
   - Marked with `is_historical: false`

## 3. Database Schema

Both pipelines store to the same `events` table with different flags:

```sql
events table:
- title: Event title
- summary: Event description
- timestamp: When it occurred
- country, region, city: Location hierarchy
- latitude, longitude: Coordinates
- severity: critical/high/medium/low
- escalation_score: 1-10
- is_historical: true (ACLED) / false (RSS)
- data_source: 'acled_import' / 'rss_ingestion'
- content_hash: Unique identifier
```

## 4. Usage in Frontend

```javascript
// For live event map (recent events)
const liveEvents = await supabase
  .from('events')
  .select('*')
  .eq('is_historical', false)
  .gte('timestamp', lastWeek)
  .order('timestamp', { ascending: false });

// For historical timeline
const historicalEvents = await supabase
  .from('events')
  .select('*')
  .eq('is_historical', true)
  .gte('timestamp', startDate)
  .lte('timestamp', endDate)
  .order('timestamp', { ascending: true });
```

## 5. Monitoring

- GitHub Actions logs show ingestion results
- Check database for:
  - Total events by source
  - Event distribution by severity
  - Geographic coverage
  - Data freshness

## 6. Troubleshooting

### ACLED Processing Issues
- **Out of memory**: Process in smaller batches with `--limit`
- **Duplicates**: The processor automatically skips existing records
- **Invalid coordinates**: Logged but doesn't stop processing

### RSS Ingestion Issues
- **Many feeds failing**: Normal - many RSS feeds go offline
- **Low relevance scores**: Adjust `minRelevanceScore` in config
- **No events stored**: Check exclusion patterns aren't too strict

## 7. Future Enhancements

1. **ACLED Updates**: Schedule quarterly imports of new ACLED data
2. **Source Quality**: Track which RSS feeds provide best data
3. **ML Improvements**: Train custom model on ACLED data for better classification
4. **Location Accuracy**: Integrate with geocoding service for better coordinates