import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { SmartFilterService } from '@/services/smart-filter-service';
import { EnhancedIngestionService } from '@/services/enhanced-ingestion-service';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const smartFilter = new SmartFilterService();
const enhancedService = new EnhancedIngestionService();

// Simple RSS fetcher
async function fetchRSS(url: string): Promise<any[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Argos Intelligence Bot/1.0',
      }
    });
    
    const text = await response.text();
    const articles: any[] = [];
    
    // Simple XML parsing
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const items = text.match(itemRegex) || [];
    
    items.forEach(item => {
      const title = extractTag(item, 'title');
      const description = extractTag(item, 'description');
      const link = extractTag(item, 'link');
      const pubDate = extractTag(item, 'pubDate');
      
      if (title || description) {
        articles.push({
          title: title || '',
          summary: description || '',
          url: link || '',
          published_date: pubDate || new Date().toISOString(),
          source: new URL(url).hostname
        });
      }
    });
    
    return articles;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return [];
  }
}

function extractTag(content: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'is');
  const match = content.match(regex);
  if (match) {
    return match[1]
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
  }
  return '';
}

// Enhanced SITREP extraction with clustering hints
const SITREP_PROMPT = `You are a geopolitical intelligence analyst AI working for the Argos OSINT platform.
Extract structured conflict events from these news articles. Output ONLY a JSON array of SITREP objects.
Each SITREP should have: 
- title: Clear, concise headline
- summary: Detailed summary (2-3 sentences)
- enhanced_headline: Improved searchable version
- country: Full country name
- city: City if available
- region: Regional context
- timestamp: ISO format
- severity: (low/medium/high/critical)
- event_type: Specific type (military_conflict/diplomatic_tension/cyber_attack/civil_unrest/humanitarian_crisis)
- primary_actors: Array of main actors
- casualties: Number if mentioned
- confidence: Your confidence in this being a real conflict event (0-1)

Only include events with confidence > 0.7.
Filter for military conflicts, diplomatic tensions, security incidents, civil unrest.`;

async function extractSITREPs(articles: any[]): Promise<any[]> {
  if (articles.length === 0) return [];
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [
        { role: 'system', content: SITREP_PROMPT },
        { role: 'user', content: JSON.stringify(articles) }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const content = response.choices[0].message.content || '[]';
    const parsed = JSON.parse(content.replace(/```json\n?|```/g, ''));
    const events = Array.isArray(parsed) ? parsed : [parsed];
    
    // Filter by confidence
    return events.filter(e => !e.confidence || e.confidence > 0.7);
  } catch (error) {
    console.error('SITREP extraction failed:', error);
    return [];
  }
}

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}` || 
                       request.headers.get('host')?.includes('vercel.app');

  if (!isAuthorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const stats = {
    sources: 0,
    articlesCollected: 0,
    articlesAfterFilter: 0,
    eventsExtracted: 0,
    eventsAfterDedup: 0,
    eventsInserted: 0,
    clustersCreated: 0,
    costSaved: 0,
    processingTime: 0
  };

  try {
    // High-priority conflict zone sources
    const RSS_SOURCES = [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://feeds.skynews.com/feeds/rss/world.xml',
      'https://rss.cnn.com/rss/cnn_topstories.rss',
      'https://feeds.nbcnews.com/nbcnews/public/world',
      'https://feeds.bbci.co.uk/news/politics/rss.xml',
      'https://feeds.bloomberg.com/politics/news.rss',
      'https://www.euronews.com/rss?format=mrss',
      'https://feeds.npr.org/1004/rss.xml',
      'https://feeds.feedburner.com/defense-news/home',
      'https://feeds.feedburner.com/WarNewsUpdates',
    ];

    stats.sources = RSS_SOURCES.length;

    // Step 1: Fetch articles from all sources
    const fetchPromises = RSS_SOURCES.map(source => fetchRSS(source));
    const results = await Promise.allSettled(fetchPromises);
    
    const allArticles: any[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    });

    stats.articlesCollected = allArticles.length;
    console.log(`📥 Collected ${allArticles.length} articles from ${RSS_SOURCES.length} sources`);

    // Step 2: Smart filtering to reduce GPT calls
    const filterResult = await smartFilter.filterArticles(allArticles);
    stats.articlesAfterFilter = filterResult.relevant.length;
    stats.costSaved = filterResult.filtered.length * 0.002; // $0.002 per GPT call saved
    
    console.log(`🎯 Smart filter: ${filterResult.stats.reductionPercent}% reduction`);
    console.log(`💰 Saved ~$${stats.costSaved.toFixed(2)} in GPT costs`);

    // Step 3: Extract SITREPs only from relevant articles
    const sitreps = await extractSITREPs(filterResult.relevant);
    stats.eventsExtracted = sitreps.length;
    console.log(`📊 Extracted ${sitreps.length} SITREPs from ${filterResult.relevant.length} relevant articles`);

    // Step 4: Convert to events with embeddings
    const events = sitreps.map(sitrep => ({
      title: sitrep.title,
      summary: sitrep.summary || sitrep.title,
      enhanced_headline: sitrep.enhanced_headline || sitrep.title,
      country: sitrep.country || 'Unknown',
      region: sitrep.region || sitrep.city || 'Unknown',
      city: sitrep.city || null,
      timestamp: sitrep.timestamp || new Date().toISOString(),
      severity: sitrep.severity || 'medium',
      event_type: sitrep.event_type || 'conflict',
      primary_actors: sitrep.primary_actors || [],
      casualties: sitrep.casualties || 0,
      source: sitrep.source || 'RSS',
      url: sitrep.url,
      confidence: sitrep.confidence || 0.8
    }));

    // Step 5: Process with semantic deduplication if enabled
    let processedEvents = events;
    if (process.env.ENABLE_VECTOR_SIMILARITY === 'true') {
      processedEvents = await enhancedService.processEventsWithML(events);
      stats.eventsAfterDedup = processedEvents.length;
      console.log(`🔍 Semantic deduplication: ${events.length - processedEvents.length} duplicates removed`);
    } else {
      // Fallback to basic deduplication
      const uniqueEvents = [];
      const seenHashes = new Set();
      
      for (const event of events) {
        const hash = await generateEventHash(event);
        if (!seenHashes.has(hash)) {
          seenHashes.add(hash);
          uniqueEvents.push(event);
        }
      }
      processedEvents = uniqueEvents;
      stats.eventsAfterDedup = processedEvents.length;
    }

    // Step 6: Insert processed events
    let inserted = 0;
    for (const event of processedEvents) {
      const { embedding, ...eventData } = event;
      
      const dbEvent = {
        ...eventData,
        embedding: embedding ? `[${embedding.join(',')}]` : null,
        channel: 'news',
        source_urls: [event.url].filter(Boolean),
        reliability_score: Math.round(event.confidence * 10),
        escalation_score: event.severity === 'critical' ? 9 : 
                          event.severity === 'high' ? 7 : 
                          event.severity === 'medium' ? 5 : 3,
      };

      const { error } = await supabase
        .from('events')
        .insert([dbEvent]);
      
      if (!error) {
        inserted++;
      }
    }
    stats.eventsInserted = inserted;

    // Step 7: Run clustering if enabled
    if (process.env.ENABLE_CLUSTERING === 'true' && inserted > 0) {
      try {
        const clusterResponse = await fetch(`${request.url.replace('/ingest-optimized', '/analytics/cluster')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeWindow: '24 hours', minClusterSize: 3 })
        });
        
        if (clusterResponse.ok) {
          const clusterData = await clusterResponse.json();
          stats.clustersCreated = clusterData.stats?.numClusters || 0;
          console.log(`🎯 Created ${stats.clustersCreated} event clusters`);
        }
      } catch (error) {
        console.error('Clustering failed:', error);
      }
    }

    stats.processingTime = Date.now() - startTime;

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      performance: {
        totalTimeMs: stats.processingTime,
        avgTimePerArticle: stats.articlesCollected > 0 ? 
          Math.round(stats.processingTime / stats.articlesCollected) : 0,
        costReduction: `${Math.round((stats.articlesCollected - stats.articlesAfterFilter) / stats.articlesCollected * 100)}%`,
        estimatedMonthlySavings: `$${(stats.costSaved * 48).toFixed(2)}` // 48 runs per day
      },
      features: {
        smartFiltering: true,
        semanticDeduplication: process.env.ENABLE_VECTOR_SIMILARITY === 'true',
        eventClustering: process.env.ENABLE_CLUSTERING === 'true'
      }
    };

    console.log(`✅ Ingestion complete in ${stats.processingTime}ms`);
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Optimized ingestion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stats,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

async function generateEventHash(event: any): Promise<string> {
  const content = [
    event.title?.trim().toLowerCase(),
    event.country?.trim().toLowerCase(),
    event.city?.trim().toLowerCase(),
    new Date(event.timestamp).toISOString().split('T')[0]
  ].filter(Boolean).join('|');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Manual trigger endpoint
export async function POST(request: Request) {
  return GET(request);
}