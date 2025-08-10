#!/bin/bash

# Start all OSINT services
echo "🚀 Starting OSINT Platform Services..."

# Kill any existing processes
pkill -f sync-without-column.js
pkill -f continuous-rss-fetch.sh

# Start continuous sync service (news to events)
echo "📍 Starting continuous sync service..."
cd /Users/bombafrontistiria/Desktop/argos/osint_app
nohup node scripts/sync-without-column.js > logs/sync-service.log 2>&1 &
SYNC_PID=$!
echo "   ✅ Sync service started (PID: $SYNC_PID)"

# Create RSS fetch loop script
cat > scripts/continuous-rss-fetch.sh << 'EOF'
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
EOF

chmod +x scripts/continuous-rss-fetch.sh

# Start RSS fetch service
echo "📡 Starting RSS fetch service..."
nohup ./scripts/continuous-rss-fetch.sh > logs/rss-fetch.log 2>&1 &
RSS_PID=$!
echo "   ✅ RSS fetch service started (PID: $RSS_PID)"

# Save PIDs for monitoring
echo "$SYNC_PID" > logs/sync-service.pid
echo "$RSS_PID" > logs/rss-fetch.pid

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Service Status:"
echo "   - Sync Service: PID $SYNC_PID (logs: logs/sync-service.log)"
echo "   - RSS Fetch: PID $RSS_PID (logs: logs/rss-fetch.log)"
echo ""
echo "🛑 To stop services: ./scripts/stop-all-services.sh"
echo "📈 To check status: ./scripts/check-services.sh"