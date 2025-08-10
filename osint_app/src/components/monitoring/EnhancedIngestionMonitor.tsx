'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  RotateCw, 
  Search, 
  Target, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  Globe
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface IngestionStatus {
  status: 'idle' | 'running' | 'completed' | 'error';
  lastRun: string | null;
  recentSearches: number;
  activeEvents: number;
  activeSources: number;
  round1Results?: number;
  round2Results?: number;
  currentPhase?: string;
}

interface SearchQuery {
  id: string;
  query_text: string;
  query_type: string;
  query_round: number;
  results_count: number;
  executed_at: string;
  success: boolean;
}

export default function EnhancedIngestionMonitor() {
  const [status, setStatus] = useState<IngestionStatus>({
    status: 'idle',
    lastRun: null,
    recentSearches: 0,
    activeEvents: 0,
    activeSources: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [recentQueries, setRecentQueries] = useState<SearchQuery[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('search_queries')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'search_queries_executed'
      }, (payload) => {
        console.log('New search query:', payload);
        fetchStatus();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/ingestion/enhanced');
      const data = await response.json();
      
      // Check if running
      const { data: runningCheck } = await supabase
        .from('search_queries_executed')
        .select('*')
        .eq('query_type', 'ingestion_run')
        .gte('executed_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('executed_at', { ascending: false })
        .limit(1);

      const isRunning = runningCheck && runningCheck.length > 0;
      
      // Get recent queries
      const { data: queries } = await supabase
        .from('search_queries_executed')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(10);

      setRecentQueries(queries || []);
      
      // Count round 1 and round 2 results
      const round1 = queries?.filter(q => q.query_round === 1).reduce((sum, q) => sum + (q.results_count || 0), 0) || 0;
      const round2 = queries?.filter(q => q.query_round === 2).reduce((sum, q) => sum + (q.results_count || 0), 0) || 0;

      setStatus({
        ...data,
        status: isRunning ? 'running' : data.status || 'idle',
        round1Results: round1,
        round2Results: round2,
        currentPhase: getCurrentPhase(queries || [])
      });
    } catch (error) {
      console.error('Error fetching status:', error);
      setStatus(prev => ({ ...prev, status: 'error' }));
    }
  };

  const getCurrentPhase = (queries: SearchQuery[]): string => {
    const recent = queries[0];
    if (!recent) return 'Idle';
    
    if (recent.query_type === 'ingestion_run') return 'Starting...';
    if (recent.query_type === 'broad' && recent.query_round === 1) return 'Round 1: Discovery';
    if (recent.query_type === 'extraction') return 'Extracting Events';
    if (recent.query_type === 'targeted' && recent.query_round === 2) return 'Round 2: Deep Search';
    if (recent.query_type === 'clustering') return 'Clustering Events';
    if (recent.query_type === 'verification') return 'Cross-Source Verification';
    if (recent.query_type === 'ingestion_complete') return 'Completed';
    
    return 'Processing...';
  };

  const startIngestion = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ingestion/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto', limit: 100 })
      });
      
      const data = await response.json();
      if (data.status === 'started' || data.status === 'already_running') {
        setStatus(prev => ({ ...prev, status: 'running' }));
        fetchStatus();
      }
    } catch (error) {
      console.error('Error starting ingestion:', error);
      setStatus(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Play className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPhaseProgress = () => {
    const phases = ['Starting...', 'Round 1: Discovery', 'Extracting Events', 'Round 2: Deep Search', 'Clustering Events', 'Cross-Source Verification', 'Completed'];
    const currentIndex = phases.indexOf(status.currentPhase || 'Idle');
    return currentIndex >= 0 ? ((currentIndex + 1) / phases.length) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Main Control Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Enhanced Ingestion Pipeline
              {getStatusIcon()}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Pause className="h-4 w-4" /> : <RotateCw className="h-4 w-4" />}
                {autoRefresh ? 'Pause' : 'Resume'}
              </Button>
              <Button
                onClick={startIngestion}
                disabled={isLoading || status.status === 'running'}
                size="sm"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start Ingestion
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          {status.status === 'running' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {status.currentPhase}
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(getPhaseProgress())}%
                </span>
              </div>
              <Progress value={getPhaseProgress()} className="h-2" />
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Active Sources</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {status.activeSources}
                <Globe className="h-4 w-4 text-muted-foreground" />
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Round 1 Results</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {status.round1Results || 0}
                <Search className="h-4 w-4 text-muted-foreground" />
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Round 2 Results</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {status.round2Results || 0}
                <Target className="h-4 w-4 text-muted-foreground" />
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Coverage Boost</p>
              <p className="text-2xl font-bold flex items-center gap-2">
                {status.round1Results && status.round2Results 
                  ? `${Math.round((status.round2Results / status.round1Results) * 100)}%`
                  : '0%'
                }
                <TrendingUp className="h-4 w-4 text-green-500" />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Queries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Search Queries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentQueries.map((query) => (
              <div key={query.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant={query.query_round === 1 ? 'default' : 'secondary'}>
                    Round {query.query_round}
                  </Badge>
                  <span className="text-sm truncate max-w-md">
                    {query.query_text}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={query.success ? 'success' : 'destructive'}>
                    {query.results_count} results
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(query.executed_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two-Round Comparison */}
      {status.round1Results && status.round2Results && (
        <Card>
          <CardHeader>
            <CardTitle>Two-Round Search Effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Round 1: Broad Discovery</p>
                  <p className="text-lg font-semibold">{status.round1Results} articles found</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">AI Processing</p>
                  <p className="text-lg">→</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Round 2: Targeted Search</p>
                  <p className="text-lg font-semibold">{status.round2Results} articles found</p>
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">
                  Enhanced algorithm discovered {Math.round((status.round2Results / status.round1Results - 1) * 100)}% more relevant content through targeted searches!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}