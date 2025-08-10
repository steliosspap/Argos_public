import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
  try {
    const { timeWindow = '24 hours', minClusterSize = 5 } = await request.json();

    // Get events with embeddings from the specified time window
    const { data: events, error } = await supabase
      .from('events')
      .select('id, embedding, enhanced_headline, timestamp, location_name')
      .not('embedding', 'is', null)
      .gte('timestamp', getTimeWindowDate(timeWindow));

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No events with embeddings found in the specified time window',
        clusters: []
      });
    }

    // Prepare data for clustering
    const eventData = events.map(e => ({
      id: e.id,
      embedding: e.embedding,
      headline: e.enhanced_headline,
      timestamp: e.timestamp,
      location: e.location_name
    }));

    // Call Python clustering script
    const scriptPath = '../osint-ingestion/scripts/cluster.py';
    const dataJson = JSON.stringify(eventData);
    
    const { stdout, stderr } = await execAsync(
      `python3 ${scriptPath} --data '${dataJson}' --min-cluster-size ${minClusterSize}`
    );

    if (stderr) {
      console.error('Clustering stderr:', stderr);
    }

    const clusteringResult = JSON.parse(stdout);

    // Update events with cluster assignments
    const updatePromises = clusteringResult.clusters.map(async (cluster: any) => {
      return supabase
        .from('events')
        .update({ cluster_id: cluster.cluster_id })
        .in('id', cluster.event_ids);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      clusters: clusteringResult.clusters,
      stats: {
        totalEvents: events.length,
        clusteredEvents: clusteringResult.clustered_count,
        noiseEvents: clusteringResult.noise_count,
        numClusters: clusteringResult.clusters.length
      }
    });

  } catch (error: any) {
    console.error('Clustering error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    // Get cluster statistics
    const { data: clusters, error } = await supabase
      .from('events')
      .select('cluster_id')
      .not('cluster_id', 'is', null)
      .order('cluster_id');

    if (error) {
      throw new Error(`Failed to fetch clusters: ${error.message}`);
    }

    // Count events per cluster
    const clusterCounts = clusters.reduce((acc: any, event: any) => {
      acc[event.cluster_id] = (acc[event.cluster_id] || 0) + 1;
      return acc;
    }, {});

    // Get sample events from each cluster
    const clusterSamples = await Promise.all(
      Object.keys(clusterCounts).map(async (clusterId) => {
        const { data: samples } = await supabase
          .from('events')
          .select('id, enhanced_headline, timestamp, severity')
          .eq('cluster_id', clusterId)
          .limit(3);

        return {
          cluster_id: clusterId,
          event_count: clusterCounts[clusterId],
          samples
        };
      })
    );

    return NextResponse.json({
      success: true,
      clusters: clusterSamples.sort((a, b) => b.event_count - a.event_count),
      totalClusters: Object.keys(clusterCounts).length,
      totalClusteredEvents: clusters.length
    });

  } catch (error: any) {
    console.error('Get clusters error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function getTimeWindowDate(timeWindow: string): string {
  const now = new Date();
  const match = timeWindow.match(/(\d+)\s*(hours?|days?|weeks?)/i);
  
  if (!match) {
    // Default to 24 hours
    now.setHours(now.getHours() - 24);
    return now.toISOString();
  }

  const [, amount, unit] = match;
  const value = parseInt(amount);

  switch (unit.toLowerCase()) {
    case 'hour':
    case 'hours':
      now.setHours(now.getHours() - value);
      break;
    case 'day':
    case 'days':
      now.setDate(now.getDate() - value);
      break;
    case 'week':
    case 'weeks':
      now.setDate(now.getDate() - (value * 7));
      break;
  }

  return now.toISOString();
}