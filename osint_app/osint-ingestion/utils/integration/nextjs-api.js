/**
 * Next.js API Integration
 * Example API routes for integrating the OSINT pipeline with Next.js
 */

// Example: pages/api/osint/ingest.js or app/api/osint/ingest/route.js (App Router)

import { IngestionService } from '../../src/services/IngestionService.js';
import { createClient } from '@supabase/supabase-js';

// For Next.js Pages Router
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication (example)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get options from request
    const { 
      limit = 50, 
      sourceType = 'all',
      dryRun = false 
    } = req.body;

    // Run ingestion
    const ingestionService = new IngestionService({
      dryRun,
      verbose: false,
      limit
    });

    const result = await ingestionService.ingest();

    // Return results
    res.status(200).json({
      success: true,
      stats: result.stats,
      eventsCount: result.events.length,
      criticalEvents: result.events
        .filter(c => c.primaryEvent.requiresAlert())
        .map(c => ({
          id: c.primaryEvent.id,
          headline: c.primaryEvent.enhancedHeadline,
          location: c.primaryEvent.locationName,
          severity: c.primaryEvent.severity,
          escalationScore: c.primaryEvent.escalationScore
        }))
    });

  } catch (error) {
    console.error('Ingestion API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// For Next.js App Router
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { limit = 50, sourceType = 'all', dryRun = false } = body;

    const ingestionService = new IngestionService({
      dryRun,
      verbose: false,
      limit
    });

    const result = await ingestionService.ingest();

    return Response.json({
      success: true,
      stats: result.stats,
      eventsCount: result.events.length,
      criticalEvents: result.events
        .filter(c => c.primaryEvent.requiresAlert())
        .map(c => ({
          id: c.primaryEvent.id,
          headline: c.primaryEvent.enhancedHeadline,
          location: c.primaryEvent.locationName,
          severity: c.primaryEvent.severity,
          escalationScore: c.primaryEvent.escalationScore
        }))
    });

  } catch (error) {
    console.error('Ingestion API error:', error);
    return Response.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Example: API route for querying events
// pages/api/osint/events.js or app/api/osint/events/route.js

export async function getEvents(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Parse query parameters
  const { 
    country,
    severity,
    days = 7,
    limit = 50,
    offset = 0
  } = req.query || req.nextUrl.searchParams;

  // Build query
  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (country) {
    query = query.ilike('country', `%${country}%`);
  }

  if (severity) {
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const minLevel = severityLevels.indexOf(severity);
    if (minLevel >= 0) {
      query = query.in('severity', severityLevels.slice(minLevel));
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - parseInt(days));
  query = query.gte('timestamp', since.toISOString());

  const { data: events, count, error } = await query;

  if (error) {
    throw error;
  }

  return {
    events,
    pagination: {
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: offset + limit < count
    }
  };
}

// Example: Real-time event subscription
// pages/api/osint/subscribe.js

export async function subscribeToEvents(req, res) {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Subscribe to new events
  const subscription = supabase
    .channel('events')
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'events',
        filter: 'severity=eq.critical'
      }, 
      (payload) => {
        res.write(`data: ${JSON.stringify(payload.new)}\n\n`);
      }
    )
    .subscribe();

  // Handle client disconnect
  req.on('close', () => {
    subscription.unsubscribe();
    res.end();
  });
}

// Example: Cron job for scheduled ingestion
// pages/api/cron/osint-ingest.js

export async function scheduledIngestion(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const ingestionService = new IngestionService({
      verbose: false,
      limit: 100
    });

    const result = await ingestionService.ingest();

    // Log to monitoring service
    console.log('Scheduled ingestion completed:', {
      timestamp: new Date().toISOString(),
      stats: result.stats
    });

    // Send alerts for critical events
    const criticalEvents = result.events
      .filter(c => c.primaryEvent.requiresAlert());

    if (criticalEvents.length > 0 && process.env.SLACK_WEBHOOK_URL) {
      await sendSlackAlert(criticalEvents);
    }

    res.status(200).json({ 
      success: true, 
      stats: result.stats,
      criticalEvents: criticalEvents.length
    });

  } catch (error) {
    console.error('Scheduled ingestion error:', error);
    res.status(500).json({ error: 'Ingestion failed' });
  }
}

// Helper: Send Slack alerts
async function sendSlackAlert(events) {
  const blocks = events.map(cluster => {
    const event = cluster.primaryEvent;
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${event.enhancedHeadline}*\n` +
              `📍 ${event.locationName}, ${event.country}\n` +
              `⚠️ Severity: ${event.severity} (${event.escalationScore}/10)\n` +
              `⏰ ${new Date(event.timestamp).toLocaleString()}`
      }
    };
  });

  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 ${events.length} Critical Events Detected`,
      blocks
    })
  });
}

// Example: Client-side hook for using OSINT data
// hooks/useOSINTEvents.js

export function useOSINTEvents(filters = {}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const params = new URLSearchParams(filters);
        const response = await fetch(`/api/osint/events?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }

        const data = await response.json();
        setEvents(data.events);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [JSON.stringify(filters)]);

  return { events, loading, error };
}

// Example usage in component:
// const { events, loading } = useOSINTEvents({ country: 'Ukraine', severity: 'high' });