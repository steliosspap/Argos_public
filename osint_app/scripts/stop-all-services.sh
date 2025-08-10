#!/bin/bash

echo "🛑 Stopping OSINT Platform Services..."

# Read PIDs if available
if [ -f logs/sync-service.pid ]; then
    SYNC_PID=$(cat logs/sync-service.pid)
    if ps -p $SYNC_PID > /dev/null; then
        kill $SYNC_PID
        echo "   ✅ Stopped sync service (PID: $SYNC_PID)"
    fi
    rm logs/sync-service.pid
fi

if [ -f logs/rss-fetch.pid ]; then
    RSS_PID=$(cat logs/rss-fetch.pid)
    if ps -p $RSS_PID > /dev/null; then
        kill $RSS_PID
        echo "   ✅ Stopped RSS fetch service (PID: $RSS_PID)"
    fi
    rm logs/rss-fetch.pid
fi

# Kill any remaining processes
pkill -f sync-without-column.js
pkill -f continuous-rss-fetch.sh

echo "✅ All services stopped"