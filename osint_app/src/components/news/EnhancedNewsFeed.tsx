'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import NewsCard from './NewsCard';
import { Event } from '@/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Search, Target, Globe } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface NewsSource {
  source_id: string;
  outlet_name: string;
  overall_reliability: number;
  factual_reporting_score: number;
  bias_score: number;
}

interface EnhancedEvent extends Event {
  discovery_round?: 1 | 2;
  source_reliability?: number;
  clustering_id?: string;
  verification_score?: number;
}

export default function EnhancedNewsFeed() {
  const [news, setNews] = useState<EnhancedEvent[]>([]);
  const [sources, setSources] = useState<Record<string, NewsSource>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'round1' | 'round2' | 'verified'>('all');
  const [stats, setStats] = useState({
    totalArticles: 0,
    round1Count: 0,
    round2Count: 0,
    verifiedCount: 0,
    avgReliability: 0
  });

  useEffect(() => {
    fetchEnhancedNews();
    fetchSources();
  }, []);

  const fetchSources = async () => {
    const { data: sourcesData } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesData) {
      const sourcesMap = sourcesData.reduce((acc, source) => {
        acc[source.outlet_name.toLowerCase()] = source;
        return acc;
      }, {} as Record<string, NewsSource>);
      setSources(sourcesMap);
    }
  };

  const fetchEnhancedNews = async () => {
    setLoading(true);
    try {
      // Fetch news articles with enhanced metadata
      const { data: newsData, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enhance news with source reliability and discovery round info from tags
      const enhancedNews = (newsData || []).map(article => {
        // Extract discovery round from tags
        const discoveryTag = article.tags?.find(t => t.startsWith('discovery:'));
        const discoveryRound = discoveryTag ? parseInt(discoveryTag.split('round')[1]) : 1;
        
        // Extract reliability from tags
        const reliabilityTag = article.tags?.find(t => t.startsWith('reliability:'));
        const reliabilityScore = reliabilityTag ? parseInt(reliabilityTag.split(':')[1]) / 100 : 0.6;

        // Get source info if available
        const sourceKey = article.source?.toLowerCase() || 
                         extractSourceFromUrl(article.url)?.toLowerCase() || 
                         '';
        const sourceInfo = sources[sourceKey];
        
        return {
          ...article,
          discovery_round: discoveryRound as 1 | 2,
          source_reliability: reliabilityScore || sourceInfo?.overall_reliability || 0.6,
          verification_score: sourceInfo?.factual_reporting_score || reliabilityScore || 0.6
        } as EnhancedEvent;
      });

      setNews(enhancedNews);
      
      // Calculate stats
      const round1 = enhancedNews.filter(n => n.discovery_round === 1);
      const round2 = enhancedNews.filter(n => n.discovery_round === 2);
      const verified = enhancedNews.filter(n => (n.verification_score || 0) >= 0.8);
      const avgRel = enhancedNews.reduce((sum, n) => sum + (n.source_reliability || 0.5), 0) / enhancedNews.length;

      setStats({
        totalArticles: enhancedNews.length,
        round1Count: round1.length,
        round2Count: round2.length,
        verifiedCount: verified.length,
        avgReliability: avgRel
      });
    } catch (error) {
      console.error('Error fetching enhanced news:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractSourceFromUrl = (url: string): string | null => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const parts = domain.split('.');
      return parts[parts.length - 2]; // Get main domain name
    } catch {
      return null;
    }
  };

  const filteredNews = news.filter(article => {
    switch (filter) {
      case 'round1':
        return article.discovery_round === 1;
      case 'round2':
        return article.discovery_round === 2;
      case 'verified':
        return (article.verification_score || 0) >= 0.8;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Enhanced Intelligence Feed
            <Badge variant="secondary" className="ml-2">
              Two-Round Search Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{stats.totalArticles}</p>
              <p className="text-sm text-muted-foreground">Total Articles</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.round1Count}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Search className="h-3 w-3" />
                Discovery
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{stats.round2Count}</p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Target className="h-3 w-3" />
                Deep Search
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{stats.verifiedCount}</p>
              <p className="text-sm text-muted-foreground">Verified</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">
                {(stats.avgReliability * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground">Avg Reliability</p>
            </div>
          </div>

          {/* Two-Round Effectiveness */}
          {stats.round2Count > 0 && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Enhanced algorithm discovered {Math.round((stats.round2Count / stats.round1Count - 1) * 100)}% more relevant content through targeted searches!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* News Feed with Filters */}
      <div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All Articles</TabsTrigger>
            <TabsTrigger value="round1">Discovery</TabsTrigger>
            <TabsTrigger value="round2">Deep Search</TabsTrigger>
            <TabsTrigger value="verified">Verified</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredNews.map((article) => (
                <NewsCard
                  key={article.id}
                  event={article}
                  sourceReliability={article.source_reliability}
                  discoveryRound={article.discovery_round}
                  onClick={() => {
                    // Handle article click
                    window.open(article.url, '_blank');
                  }}
                />
              ))}
            </div>

            {filteredNews.length === 0 && (
              <div className="text-center py-12">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No articles found for this filter</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}