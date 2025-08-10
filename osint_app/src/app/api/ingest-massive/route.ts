import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'edge';
export const maxDuration = 300; // 5 minutes for Pro plan

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Massive source list - all confirmed working sources
const MASSIVE_RSS_SOURCES = [
  // Primary news sources
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://feeds.skynews.com/feeds/rss/world.xml',
  'http://rss.cnn.com/rss/cnn_topstories.rss',
  'https://feeds.nbcnews.com/nbcnews/public/world',
  'https://www.euronews.com/rss?format=mrss',
  'https://feeds.npr.org/1004/rss.xml',
  'https://feeds.bloomberg.com/politics/news.rss',
  
  // BBC regional feeds
  'http://feeds.bbci.co.uk/news/politics/rss.xml',
  'http://feeds.bbci.co.uk/news/business/rss.xml',
  'http://feeds.bbci.co.uk/news/technology/rss.xml',
  'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  'http://feeds.bbci.co.uk/news/england/rss.xml',
  
  // Defense and military
  'https://feeds.feedburner.com/defense-news/home',
  'https://feeds.feedburner.com/WarNewsUpdates',
  'https://feeds.feedburner.com/TheAviationist',
  'https://www.defensenews.com/arc/outboundfeeds/rss/category/global/?outputType=xml',
  'https://feeds.feedburner.com/Military-Today',
  
  // Regional conflict monitoring
  'https://feeds.feedburner.com/MiddleEastNews',
  'https://www.middleeasteye.net/rss',
  'https://feeds.feedburner.com/AfricaDefenseJournal',
  'https://jamestown.org/feed/',
  
  // Technology and cyber
  'https://feeds.feedburner.com/TheHackersNews',
  'https://krebsonsecurity.com/feed/',
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/Securityweek',
  
  // International affairs
  'https://www.cfr.org/rss.xml',
  'https://feeds.foreignpolicy.com/fp_main',
  'https://www.foreignaffairs.com/rss.xml',
  'https://feeds.feedburner.com/StrategyPage',
  
  // More global sources
  'https://www.rt.com/rss/',
  'https://sputniknews.com/export/rss2/archive/index.xml',
  'https://www.scmp.com/rss/91/feed',
  'https://www3.nhk.or.jp/nhkworld/en/news/rss/index.xml',
  'https://feeds.france24.com/en/rss',
  'https://www.dw.com/rss/en-world',
  
  // Specialized sources
  'https://www.janes.com/feeds/news',
  'https://feeds.feedburner.com/stratfor/geopolitical-diary',
  'https://www.longwarjournal.org/feed',
  'https://feeds.feedburner.com/SouthAsiaAnalysisGroup'
];

async function fetchRSSBatch(urls: string[]): Promise<any[]> {
  const promises = urls.map(async (url) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Argos Intelligence Bot/2.0',
        },
        signal: AbortSignal.timeout(10000) // 10s timeout per feed
      });
      
      if (!response.ok) return [];
      
      const text = await response.text();
      const articles: any[] = [];
      
      // Enhanced XML parsing
      const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
      const entryRegex = /<entry[^>]*>(.*?)<\/entry>/gs;
      
      const items = [...(text.match(itemRegex) || []), ...(text.match(entryRegex) || [])];
      
      items.forEach(item => {
        const title = extractTag(item, 'title');
        const description = extractTag(item, 'description') || extractTag(item, 'summary');
        const link = extractTag(item, 'link') || extractAttribute(item, 'link', 'href');
        const pubDate = extractTag(item, 'pubDate') || extractTag(item, 'published') || extractTag(item, 'updated');
        
        if (title && (description || link)) {
          articles.push({
            title: cleanText(title),
            summary: cleanText(description || ''),
            url: link || '',
            published_date: pubDate || new Date().toISOString(),
            source: new URL(url).hostname
          });
        }
      });
      
      return articles;
    } catch (error) {
      console.error(`Failed ${url}:`, error);
      return [];
    }
  });
  
  const results = await Promise.allSettled(promises);
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}

function extractTag(content: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[(.*?)\\]\\]></${tagName}>|<${tagName}[^>]*>(.*?)</${tagName}>`, 'is');
  const match = content.match(regex);
  return match ? (match[1] || match[2] || '').trim() : '';
}

function extractAttribute(content: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i');
  const match = content.match(regex);
  return match ? match[1] : '';
}

function cleanText(text: string): string {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Enhanced SITREP prompt for better extraction
const ENHANCED_SITREP_PROMPT = `You are an elite geopolitical intelligence analyst for Argos OSINT platform.
Extract ALL significant events from these news articles that relate to:
- Military operations, movements, or conflicts
- Diplomatic tensions or negotiations  
- Security incidents, attacks, or threats
- Civil unrest, protests, or political instability
- Arms deals, military exercises, or defense agreements
- Cyber attacks or information warfare
- Economic sanctions or trade conflicts with security implications
- Natural disasters affecting stability
- Humanitarian crises in conflict zones

Output a JSON array with MAXIMUM events extracted. Each event must have:
{
  "title": "Clear, specific headline",
  "summary": "2-3 sentence summary with key details",
  "country": "Primary country affected",
  "city": "Specific city if mentioned",
  "region": "Region or state", 
  "timestamp": "ISO date from article or today",
  "severity": "low/medium/high/critical",
  "event_type": "conflict/diplomatic/security/civil_unrest/military/cyber/economic/humanitarian",
  "actors": ["List of countries/groups involved"],
  "reliability": 1-10 score
}

BE AGGRESSIVE in extraction - if it could be relevant to global security, include it.`;

async function extractMassiveSITREPs(articles: any[]): Promise<any[]> {
  if (articles.length === 0) return [];
  
  // Process in larger batches for efficiency
  const batchSize = 100;
  const allSitreps: any[] = [];
  
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-16k',
        messages: [
          { role: 'system', content: ENHANCED_SITREP_PROMPT },
          { role: 'user', content: `Extract ALL security-relevant events from these ${batch.length} articles:\n\n${JSON.stringify(batch)}` }
        ],
        temperature: 0.3,
        max_tokens: 8000
      });

      const content = response.choices[0].message.content || '[]';
      const parsed = JSON.parse(content.replace(/```json\n?|```/g, ''));
      const sitreps = Array.isArray(parsed) ? parsed : [parsed];
      
      allSitreps.push(...sitreps);
      
    } catch (error) {
      console.error(`Batch ${i/batchSize} extraction failed:`, error);
    }
  }
  
  return allSitreps;
}

async function generateEventHash(event: any): Promise<string> {
  const content = [
    event.title?.trim().toLowerCase(),
    event.country?.trim().toLowerCase(),
    (event.city || event.region)?.trim().toLowerCase(),
    new Date(event.timestamp).toISOString().split('T')[0]
  ].filter(Boolean).join('|');
  
  // Use Web Crypto API for Edge runtime
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Process sources in parallel batches
    const batchSize = 10;
    const allArticles: any[] = [];
    
    for (let i = 0; i < MASSIVE_RSS_SOURCES.length; i += batchSize) {
      const batch = MASSIVE_RSS_SOURCES.slice(i, i + batchSize);
      const articles = await fetchRSSBatch(batch);
      allArticles.push(...articles);
      
      // Real-time progress update
      console.log(`Progress: ${i + batchSize}/${MASSIVE_RSS_SOURCES.length} sources, ${allArticles.length} articles`);
    }

    console.log(`Fetched ${allArticles.length} articles from ${MASSIVE_RSS_SOURCES.length} sources`);

    // Extract massive amounts of SITREPs
    const sitreps = await extractMassiveSITREPs(allArticles);
    console.log(`Extracted ${sitreps.length} SITREPs`);

    // Bulk insert with deduplication
    let inserted = 0;
    let duplicates = 0;
    
    // Process in transaction for speed
    const events = await Promise.all(sitreps.map(async sitrep => ({
      title: sitrep.title,
      summary: sitrep.summary || sitrep.title,
      country: sitrep.country || 'Unknown',
      region: sitrep.region || sitrep.city || 'Unknown',
      city: sitrep.city || null,
      coordinates: null, // Will be geocoded separately
      timestamp: sitrep.timestamp || new Date().toISOString(),
      severity: sitrep.severity || 'medium',
      event_type: sitrep.event_type || 'conflict',
      channel: 'news',
      source_urls: [],
      reliability_score: sitrep.reliability || 7,
      escalation_score: sitrep.severity === 'critical' ? 9 : sitrep.severity === 'high' ? 8 : 7,
      content_hash: await generateEventHash(sitrep),
      tags: sitrep.actors || []
    })));

    // Check existing hashes
    const { data: existingHashes } = await supabase
      .from('events')
      .select('content_hash')
      .in('content_hash', events.map(e => e.content_hash));

    const existingHashSet = new Set(existingHashes?.map(e => e.content_hash) || []);
    
    // Filter new events
    const newEvents = events.filter(e => !existingHashSet.has(e.content_hash));
    duplicates = events.length - newEvents.length;

    // Bulk insert new events
    if (newEvents.length > 0) {
      const { data, error } = await supabase
        .from('events')
        .insert(newEvents)
        .select('id, country, escalation_score');
      
      if (!error) {
        inserted = data?.length || 0;
        
        // Update conflict zone escalations with new events
        const eventsByCountry = data.reduce((acc: any, event: any) => {
          if (!acc[event.country]) acc[event.country] = [];
          acc[event.country].push({
            id: event.id,
            escalation_score: event.escalation_score
          });
          return acc;
        }, {});
        
        // Update each affected country's conflicts
        for (const [country, countryEvents] of Object.entries(eventsByCountry)) {
          await supabase.rpc('update_country_conflict_escalations', {
            p_country: country,
            p_new_events: countryEvents
          }).catch(err => console.warn(`Failed to update ${country} escalations:`, err));
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration.toFixed(2)}s`,
      stats: {
        sources: MASSIVE_RSS_SOURCES.length,
        articlesProcessed: allArticles.length,
        sitrepsExtracted: sitreps.length,
        eventsInserted: inserted,
        duplicatesSkipped: duplicates,
        articlesPerSecond: (allArticles.length / duration).toFixed(1),
        eventsPerMinute: ((inserted / duration) * 60).toFixed(1)
      },
      performance: {
        totalTime: duration,
        avgTimePerSource: (duration / MASSIVE_RSS_SOURCES.length).toFixed(2),
        avgTimePerArticle: (duration / allArticles.length * 1000).toFixed(1) + 'ms'
      }
    };

    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Massive ingestion error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}