import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { EnhancedIngestionService } from '@/services/enhanced-ingestion-service';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const enhancedService = new EnhancedIngestionService();

// Enable features based on environment variables
if (process.env.ENABLE_VECTOR_SIMILARITY === 'true') {
  console.log('Vector similarity deduplication enabled');
}
if (process.env.ENABLE_CLUSTERING === 'true') {
  enhancedService.enableClustering(true);
  console.log('HDBSCAN clustering enabled');
}
if (process.env.ENABLE_TRANSLATION === 'true') {
  enhancedService.enableTranslation(true);
  console.log('Multi-language translation enabled');
}

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
          source: 'RSS Feed'
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

// Enhanced SITREP extraction prompt
const SITREP_PROMPT = `You are a geopolitical intelligence analyst AI working for the Argos OSINT platform.
Extract structured conflict events from these news articles. Output ONLY a JSON array of SITREP objects.
Each SITREP should have: 
- title: Clear, concise headline
- summary: Detailed summary of the event
- enhanced_headline: Enhanced version for better searchability
- country: Full country name
- city: City name if available
- region: Regional context
- timestamp: ISO format timestamp
- severity: (low/medium/high/critical)
- event_type: Type of conflict/event
- primary_actors: Array of main actors involved
- casualties: Number if mentioned
Include only military conflicts, diplomatic tensions, security incidents, civil unrest.`;

async function extractSITREPs(articles: any[]): Promise<any[]> {
  if (articles.length === 0) return [];
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SITREP_PROMPT },
        { role: 'user', content: JSON.stringify(articles.slice(0, 30)) }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const content = response.choices[0].message.content || '[]';
    const parsed = JSON.parse(content.replace(/```json\n?|```/g, ''));
    return Array.isArray(parsed) ? parsed : [parsed];
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

  try {
    // Extended source list including multi-language sources
    const RSS_SOURCES = [
      // English sources
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://feeds.skynews.com/feeds/rss/world.xml',
      'https://rss.cnn.com/rss/cnn_topstories.rss',
      
      // Multi-language sources (if translation enabled)
      ...(process.env.ENABLE_TRANSLATION === 'true' ? [
        'https://www.lemonde.fr/rss/une.xml', // French
        'https://rss.dw.com/rdf/rss-de-all', // German
        'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', // Spanish
        'https://arabic.rt.com/rss/', // Arabic
        'https://www3.nhk.or.jp/rss/news/cat0.xml', // Japanese
      ] : [])
    ];

    // Fetch articles from all sources
    const allArticles: any[] = [];
    const fetchPromises = RSS_SOURCES.map(source => fetchRSS(source));
    const results = await Promise.allSettled(fetchPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    });

    console.log(`Fetched ${allArticles.length} articles from ${RSS_SOURCES.length} sources`);

    // Extract SITREPs using AI
    const sitreps = await extractSITREPs(allArticles);
    console.log(`Extracted ${sitreps.length} SITREPs`);

    // Convert to events format
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
      url: sitrep.url
    }));

    // Process events through ML pipeline
    const processedEvents = await enhancedService.processEventsWithML(events);
    
    // Insert processed events
    let inserted = 0;
    let failed = 0;
    
    for (const event of processedEvents) {
      const { embedding, ...eventData } = event;
      
      // Prepare event for insertion
      const dbEvent = {
        ...eventData,
        embedding: embedding ? `[${embedding.join(',')}]` : null,
        channel: 'news',
        source_urls: [event.url].filter(Boolean),
        reliability_score: 7,
        escalation_score: event.severity === 'critical' ? 9 : 7,
      };

      const { error } = await supabase
        .from('events')
        .insert([dbEvent]);
      
      if (!error) {
        inserted++;
      } else {
        failed++;
        console.error('Insert error:', error);
      }
    }

    // Run clustering if enabled
    if (process.env.ENABLE_CLUSTERING === 'true') {
      await enhancedService.clusterEvents('24 hours');
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        sources: RSS_SOURCES.length,
        articlesProcessed: allArticles.length,
        sitrepsExtracted: sitreps.length,
        eventsProcessed: processedEvents.length,
        eventsInserted: inserted,
        duplicatesRemoved: sitreps.length - processedEvents.length,
        failed: failed
      },
      features: {
        vectorSimilarity: process.env.ENABLE_VECTOR_SIMILARITY === 'true',
        clustering: process.env.ENABLE_CLUSTERING === 'true',
        translation: process.env.ENABLE_TRANSLATION === 'true'
      }
    };

    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Enhanced ingestion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
}

// Manual trigger endpoint
export async function POST(request: Request) {
  return GET(request);
}