# Argos Cost Tracking Guide

## Overview

This guide explains how to use the internal cost tracking system for Argos. The system tracks all operational costs including infrastructure, API usage, and per-operation costs.

## Accessing the Cost Dashboard

1. Navigate to `/internal/costs`
2. Enter the authentication token (set `INTERNAL_METRICS_TOKEN` in your environment)
3. View comprehensive cost analytics

## Cost Breakdown

### Infrastructure Costs (Monthly)
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month  
- **Domain**: $20/year ($1.67/month)
- **Mapbox**: Free tier (up to 50k loads/month)

### Operational Costs (Per Item)
- **Event Processing**: $0.002 per event
- **News Processing**: $0.001 per article
- **Arms Deal Processing**: $0.0005 per deal
- **Conflict Calculation**: $0.003 per calculation
- **OpenAI API**: $0.002 per 1k tokens
- **Map Load**: $0.001 per user load

### Development Costs
- **Claude Development**: 150 hours @ $100/hr = $15,000
- **Other Development**: Variable

## Implementing Cost Tracking in Sync Scripts

### 1. Update Sync Scripts

Wrap your sync functions with cost tracking:

```javascript
const { withCostTracking } = require('./utils/withCostTracking');

// Original sync function
async function syncEvents(metrics) {
  // Your sync logic here
  
  // Update metrics object
  metrics.itemsProcessed += events.length;
  metrics.itemsCreated += newEvents.length;
  metrics.apiCalls += apiCallsMade;
  
  return result;
}

// Wrapped with cost tracking
const trackableSyncEvents = withCostTracking('events', syncEvents);

// Use the wrapped version
trackableSyncEvents();
```

### 2. Track API Usage

```javascript
const { trackApiUsage } = require('@/utils/costTracking');

// After making an API call
await trackApiUsage(
  'openai',           // service
  '/v1/completions',  // endpoint
  tokensUsed,         // tokens
  responseTime,       // ms
  200                 // status code
);
```

### 3. Track User Activities

In your frontend components:

```typescript
import { trackUserActivity } from '@/utils/costTracking';

// When user loads map
await trackUserActivity(
  userId,
  'map_load',
  { zoom: mapZoom, bounds: mapBounds }
);

// When user searches
await trackUserActivity(
  userId,
  'search',
  { query: searchQuery, results: resultCount }
);
```

## Key Metrics Explained

### Cost per User
- **Total Cost per User**: Total monthly costs / total users
- **Cost per Active User**: Total monthly costs / active users (30d)
- **Infrastructure per User**: Fixed costs / total users

### Break-even Analysis
- **Break-even Users**: Monthly costs / subscription price
- **At $10/month**: Need ~5-10 users to cover infrastructure
- **At $50/month**: Need 1-2 users to break even

### Scaling Costs
- **Per 1000 Users**: ~$50-100 in infrastructure
- **API Costs**: Scale linearly with usage
- **Database**: Included in Supabase Pro up to 500GB

## Cost Optimization Tips

1. **Batch Operations**: Process multiple items in single API calls
2. **Cache Results**: Use Redis/memory cache for repeated queries
3. **Optimize Queries**: Use database indexes and efficient queries
4. **Monitor Usage**: Set up alerts for unusual spikes

## Database Schema

### pipeline_runs
- Tracks each pipeline execution
- Stores items processed, costs, errors
- Used for historical analysis

### api_usage
- Tracks individual API calls
- Monitors token usage and costs
- Identifies expensive operations

### user_activity_costs
- Tracks per-user resource usage
- Helps identify heavy users
- Guides pricing decisions

## Setting Up Monitoring

1. Run the cost tracking migration:
```bash
psql $DATABASE_URL < database/migrations/add_cost_tracking.sql
```

2. Set environment variable for dashboard access:
```bash
INTERNAL_METRICS_TOKEN=your-secret-token
```

3. Update sync scripts to include cost tracking
4. Deploy and monitor via `/internal/costs`

## Important Notes

- All cost data is restricted to service role access only
- The dashboard is for internal use only - do not expose publicly
- Costs are estimates based on usage patterns
- Actual cloud bills may vary slightly

## Monthly Review Process

1. Check actual bills from Vercel, Supabase, etc.
2. Compare with tracked costs
3. Adjust cost constants if needed
4. Review user growth vs. cost growth
5. Optimize high-cost operations