#!/bin/bash

echo "📊 OSINT Platform Service Status"
echo "================================"

# Check sync service
if [ -f logs/sync-service.pid ]; then
    SYNC_PID=$(cat logs/sync-service.pid)
    if ps -p $SYNC_PID > /dev/null 2>&1; then
        echo "✅ Sync Service: Running (PID: $SYNC_PID)"
        echo "   Last logs:"
        tail -5 logs/sync-service.log | sed 's/^/   /'
    else
        echo "❌ Sync Service: Not running"
    fi
else
    echo "❌ Sync Service: No PID file"
fi

echo ""

# Check RSS fetch service
if [ -f logs/rss-fetch.pid ]; then
    RSS_PID=$(cat logs/rss-fetch.pid)
    if ps -p $RSS_PID > /dev/null 2>&1; then
        echo "✅ RSS Fetch Service: Running (PID: $RSS_PID)"
        echo "   Last logs:"
        tail -5 logs/rss-fetch.log 2>/dev/null | sed 's/^/   /' || echo "   No logs yet"
    else
        echo "❌ RSS Fetch Service: Not running"
    fi
else
    echo "❌ RSS Fetch Service: No PID file"
fi

echo ""

# Check database stats
echo "📈 Database Statistics:"
node -e "
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { count: eventCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  
  const { count: newsCount } = await supabase
    .from('news')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
  
  console.log(\`   Total events: \${eventCount}\`);
  console.log(\`   News (24h): \${newsCount}\`);
})();
" 2>/dev/null || echo "   Unable to fetch stats"