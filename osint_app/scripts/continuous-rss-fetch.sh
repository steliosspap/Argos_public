#!/bin/bash
cd /Users/bombafrontistiria/Desktop/argos/osint_app

while true; do
    echo "🌍 Fetching RSS feeds at $(date)"
    
    # Fetch RSS from different sources
    node scripts/global-rss-fetcher.js high-priority
    sleep 300  # Wait 5 minutes
    
    node scripts/global-rss-fetcher.js language ru
    sleep 300
    
    node scripts/global-rss-fetcher.js language zh
    sleep 300
    
    node scripts/global-rss-fetcher.js language ar
    sleep 300
    
    # Ingest the latest RSS file
    LATEST_RSS=$(ls -t data/rss-ingestion/global-rss-fetch-*.json | head -1)
    if [ -f "$LATEST_RSS" ]; then
        echo "📥 Ingesting $LATEST_RSS"
        node scripts/ingest-rss-batch.js "$LATEST_RSS"
    fi
    
    # Wait 30 minutes before next cycle
    sleep 1800
done
