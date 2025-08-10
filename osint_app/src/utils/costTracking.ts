import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cost constants
export const OPERATION_COSTS = {
  // Per item costs
  EVENT_PROCESSING: 0.002,
  NEWS_PROCESSING: 0.001,
  ARMS_DEAL_PROCESSING: 0.0005,
  CONFLICT_CALCULATION: 0.003,
  
  // API costs
  OPENAI_API_CALL: 0.002,
  NEWS_API_CALL: 0.0001,
  MAPBOX_API_CALL: 0.0001,
  
  // Token costs (per 1k tokens)
  GPT3_TOKENS: 0.002,
  GPT4_TOKENS: 0.03,
};

export interface PipelineRunMetrics {
  runType: 'events' | 'news' | 'arms_deals' | 'conflicts';
  itemsProcessed: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  apiCalls?: number;
  tokensUsed?: number;
  errors?: number;
  metadata?: any;
}

export async function trackPipelineRun(metrics: PipelineRunMetrics) {
  try {
    // Calculate cost
    let cost = 0;
    
    // Base processing cost
    switch (metrics.runType) {
      case 'events':
        cost += metrics.itemsProcessed * OPERATION_COSTS.EVENT_PROCESSING;
        break;
      case 'news':
        cost += metrics.itemsProcessed * OPERATION_COSTS.NEWS_PROCESSING;
        break;
      case 'arms_deals':
        cost += metrics.itemsProcessed * OPERATION_COSTS.ARMS_DEAL_PROCESSING;
        break;
      case 'conflicts':
        cost += metrics.itemsProcessed * OPERATION_COSTS.CONFLICT_CALCULATION;
        break;
    }
    
    // Add API costs
    if (metrics.apiCalls) {
      cost += metrics.apiCalls * OPERATION_COSTS.OPENAI_API_CALL;
    }
    
    // Add token costs
    if (metrics.tokensUsed) {
      cost += (metrics.tokensUsed / 1000) * OPERATION_COSTS.GPT3_TOKENS;
    }
    
    // Store in database
    const { data, error } = await supabase
      .from('pipeline_runs')
      .insert({
        run_type: metrics.runType,
        items_processed: metrics.itemsProcessed,
        items_created: metrics.itemsCreated || 0,
        items_updated: metrics.itemsUpdated || 0,
        api_calls_made: metrics.apiCalls || 0,
        tokens_used: metrics.tokensUsed || 0,
        estimated_cost: cost,
        error_count: metrics.errors || 0,
        metadata: metrics.metadata || {},
        completed_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to track pipeline run:', error);
      return null;
    }
    
    console.log(`Pipeline run tracked: ${metrics.runType} - Cost: $${cost.toFixed(4)}`);
    return data;
  } catch (error) {
    console.error('Error tracking pipeline run:', error);
    return null;
  }
}

export async function trackApiUsage(
  service: string,
  endpoint: string,
  tokensUsed: number = 0,
  responseTimeMs: number = 0,
  statusCode: number = 200
) {
  try {
    // Calculate cost based on service
    let cost = 0;
    
    switch (service.toLowerCase()) {
      case 'openai':
        cost = (tokensUsed / 1000) * OPERATION_COSTS.GPT3_TOKENS;
        break;
      case 'mapbox':
        cost = OPERATION_COSTS.MAPBOX_API_CALL;
        break;
      case 'news_api':
        cost = OPERATION_COSTS.NEWS_API_CALL;
        break;
    }
    
    const { error } = await supabase
      .from('api_usage')
      .insert({
        service,
        endpoint,
        tokens_used: tokensUsed,
        cost,
        response_time_ms: responseTimeMs,
        status_code: statusCode
      });
    
    if (error) {
      console.error('Failed to track API usage:', error);
    }
  } catch (error) {
    console.error('Error tracking API usage:', error);
  }
}

export async function trackUserActivity(
  userId: string,
  activityType: 'map_load' | 'search' | 'export' | 'filter' | 'view_event',
  resourceUsage: any = {}
) {
  try {
    // Calculate cost based on activity
    let cost = 0;
    
    switch (activityType) {
      case 'map_load':
        cost = 0.001; // Small cost for map loads
        break;
      case 'search':
        cost = 0.0005; // Search query cost
        break;
      case 'export':
        cost = 0.002; // Data export cost
        break;
      default:
        cost = 0.0001; // Minimal cost for other activities
    }
    
    const { error } = await supabase
      .from('user_activity_costs')
      .insert({
        user_id: userId,
        activity_type: activityType,
        resource_usage: resourceUsage,
        estimated_cost: cost
      });
    
    if (error) {
      console.error('Failed to track user activity:', error);
    }
  } catch (error) {
    console.error('Error tracking user activity:', error);
  }
}

// Utility to get cost summary for a time period
export async function getCostSummary(days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get pipeline costs
    const { data: pipelineData } = await supabase
      .from('pipeline_runs')
      .select('estimated_cost')
      .gte('completed_at', startDate.toISOString());
    
    // Get API costs
    const { data: apiData } = await supabase
      .from('api_usage')
      .select('cost')
      .gte('created_at', startDate.toISOString());
    
    // Get user activity costs
    const { data: activityData } = await supabase
      .from('user_activity_costs')
      .select('estimated_cost')
      .gte('created_at', startDate.toISOString());
    
    const pipelineCost = pipelineData?.reduce((sum, item) => sum + (item.estimated_cost || 0), 0) || 0;
    const apiCost = apiData?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
    const activityCost = activityData?.reduce((sum, item) => sum + (item.estimated_cost || 0), 0) || 0;
    
    return {
      pipelineCost,
      apiCost,
      activityCost,
      totalOperationalCost: pipelineCost + apiCost + activityCost,
      dailyAverage: (pipelineCost + apiCost + activityCost) / days
    };
  } catch (error) {
    console.error('Error getting cost summary:', error);
    return null;
  }
}