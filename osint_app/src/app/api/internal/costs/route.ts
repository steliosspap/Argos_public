import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cost constants (in USD)
const COSTS = {
  // Infrastructure
  VERCEL_PRO_MONTHLY: 20,
  SUPABASE_PRO_MONTHLY: 25,
  MAPBOX_MONTHLY_BASE: 0, // Free tier
  DOMAIN_YEARLY: 20,
  
  // API Costs per request
  OPENAI_GPT4_PER_1K_TOKENS: 0.03,
  OPENAI_GPT3_PER_1K_TOKENS: 0.002,
  MAPBOX_API_PER_REQUEST: 0.0001, // After free tier
  
  // Claude/Anthropic costs (estimated)
  CLAUDE_DEVELOPMENT_HOURS: 150, // Hours spent
  CLAUDE_HOURLY_RATE: 100, // Estimated value
  
  // Per operation costs
  NEWS_INGESTION_PER_ARTICLE: 0.001, // Processing cost
  EVENT_PROCESSING_COST: 0.002,
  ESCALATION_CALCULATION_COST: 0.0001,
};

interface CostMetrics {
  infrastructure: {
    monthly: number;
    daily: number;
    perUser: number;
  };
  operations: {
    totalPipelineRuns: number;
    costPerPipelineRun: number;
    totalApiCalls: number;
    apiCosts: number;
  };
  users: {
    totalUsers: number;
    activeUsers: number;
    costPerUser: number;
    costPerActiveUser: number;
  };
  development: {
    initialDevelopment: number;
    claudeAssistance: number;
    totalDevCost: number;
  };
  projections: {
    monthlyRunRate: number;
    annualRunRate: number;
    breakEvenUsers: number;
    costPer1000Users: number;
  };
  totals: {
    totalCostToDate: number;
    totalOperationalCost: number;
    totalRevenueNeeded: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check for internal auth token
    const authToken = request.headers.get('x-internal-auth');
    if (authToken !== process.env.INTERNAL_METRICS_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current date info
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const monthsOperational = 1; // Adjust based on actual launch date

    // Fetch user metrics
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Fetch operational metrics
    const { count: totalEvents } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true });

    const { count: totalNews } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true });

    const { count: totalArmsDeals } = await supabase
      .from('arms_deals')
      .select('*', { count: 'exact', head: true });

    // Calculate pipeline runs (estimate based on data)
    const estimatedPipelineRuns = Math.ceil((totalEvents || 0) / 50); // Assuming 50 events per run

    // Calculate costs
    const monthlyInfrastructure = 
      COSTS.VERCEL_PRO_MONTHLY + 
      COSTS.SUPABASE_PRO_MONTHLY + 
      COSTS.MAPBOX_MONTHLY_BASE +
      (COSTS.DOMAIN_YEARLY / 12);

    const dailyInfrastructure = monthlyInfrastructure / daysInMonth;

    // API costs (estimated)
    const totalApiCalls = (totalEvents || 0) * 3 + (totalNews || 0) * 2; // Rough estimate
    const apiCosts = totalApiCalls * COSTS.OPENAI_GPT3_PER_1K_TOKENS;

    // Cost per pipeline run
    const costPerPipelineRun = 
      (totalEvents || 0) * COSTS.EVENT_PROCESSING_COST / estimatedPipelineRuns +
      (totalNews || 0) * COSTS.NEWS_INGESTION_PER_ARTICLE / estimatedPipelineRuns;

    // Development costs
    const claudeDevelopmentCost = COSTS.CLAUDE_DEVELOPMENT_HOURS * COSTS.CLAUDE_HOURLY_RATE;

    // User costs
    const costPerUser = totalUsers ? 
      (monthlyInfrastructure + apiCosts) / totalUsers : 0;
    
    const costPerActiveUser = activeUsers ? 
      (monthlyInfrastructure + apiCosts) / activeUsers : 0;

    // Projections
    const monthlyRunRate = monthlyInfrastructure + (apiCosts * 30 / dayOfMonth);
    const annualRunRate = monthlyRunRate * 12;
    
    // Break-even calculation (assuming $10/month subscription)
    const subscriptionPrice = 10;
    const breakEvenUsers = Math.ceil(monthlyRunRate / subscriptionPrice);

    // Total costs
    const totalOperationalCost = 
      (monthlyInfrastructure * monthsOperational) + 
      apiCosts;
    
    const totalCostToDate = 
      totalOperationalCost + 
      claudeDevelopmentCost;

    const metrics: CostMetrics = {
      infrastructure: {
        monthly: monthlyInfrastructure,
        daily: dailyInfrastructure,
        perUser: totalUsers ? monthlyInfrastructure / totalUsers : 0
      },
      operations: {
        totalPipelineRuns: estimatedPipelineRuns,
        costPerPipelineRun: costPerPipelineRun,
        totalApiCalls: totalApiCalls,
        apiCosts: apiCosts
      },
      users: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        costPerUser: costPerUser,
        costPerActiveUser: costPerActiveUser
      },
      development: {
        initialDevelopment: 0, // Add if you have other dev costs
        claudeAssistance: claudeDevelopmentCost,
        totalDevCost: claudeDevelopmentCost
      },
      projections: {
        monthlyRunRate: monthlyRunRate,
        annualRunRate: annualRunRate,
        breakEvenUsers: breakEvenUsers,
        costPer1000Users: (monthlyInfrastructure + (apiCosts * 1000 / (totalUsers || 1)))
      },
      totals: {
        totalCostToDate: totalCostToDate,
        totalOperationalCost: totalOperationalCost,
        totalRevenueNeeded: totalCostToDate * 1.5 // 50% margin
      }
    };

    // Store metrics in database for historical tracking
    await supabase
      .from('cost_metrics')
      .insert({
        metrics: metrics,
        calculated_at: new Date().toISOString()
      });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Cost calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate costs' },
      { status: 500 }
    );
  }
}