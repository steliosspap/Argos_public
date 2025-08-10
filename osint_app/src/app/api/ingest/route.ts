import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// SITREP extraction prompt
const SITREP_PROMPT = `You are a geopolitical intelligence analyst AI working for the Argos OSINT platform.
Extract structured conflict events from these news articles. Output ONLY a JSON array of SITREP objects.
Each SITREP should have: title, summary, country, city, region, timestamp, severity (low/medium/high/critical), event_type.
Filter for military conflicts, diplomatic tensions, security incidents, civil unrest only.`;

async function extractSITREPs(articles: any[]): Promise<any[]> {
  if (articles.length === 0) return [];
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      messages: [
        { role: 'system', content: SITREP_PROMPT },
        { role: 'user', content: JSON.stringify(articles.slice(0, 50)) } // Limit to 50 articles
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

async function generateEventHash(event: any): Promise<string> {
  const content = [
    event.title?.trim().toLowerCase(),
    event.country?.trim().toLowerCase(),
    event.city?.trim().toLowerCase(),
    new Date(event.timestamp).toISOString().split('T')[0]
  ].filter(Boolean).join('|');
  
  // Use Web Crypto API for Edge runtime compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function GET(request: Request) {
  // Verify authorization (optional)
  const authHeader = request.headers.get('authorization');
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}` || 
                       request.headers.get('host')?.includes('vercel.app');

  if (!isAuthorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // High-priority conflict zone sources
    const PRIORITY_SOURCES = [
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
      // Add more working sources
      'https://feeds.bbci.co.uk/news/business/rss.xml',
      'https://feeds.bbci.co.uk/news/technology/rss.xml',
      'https://feeds.feedburner.com/defense-news/home',
      'https://feeds.feedburner.com/WarNewsUpdates',
      'https://feeds.feedburner.com/TheAviationist',
      'https://www.janes.com/feeds/news',
      'https://feeds.defensenews.com/rss/congresswatch',
      'https://feeds.feedburner.com/ImpactLab',
      'https://feeds.techcrunch.com/TechCrunch/',
      'https://www.theregister.com/headlines.atom'
    ];
    
    // Use priority sources for now (Vercel has time limits)
    const RSS_SOURCES = PRIORITY_SOURCES;

    // Fetch articles from all sources
    const allArticles: any[] = [];
    for (const source of RSS_SOURCES) {
      const articles = await fetchRSS(source);
      allArticles.push(...articles);
    }

    console.log(`Fetched ${allArticles.length} articles from ${RSS_SOURCES.length} sources`);

    // Extract SITREPs using AI
    const sitreps = await extractSITREPs(allArticles);
    console.log(`Extracted ${sitreps.length} SITREPs`);

    // Convert to events and insert
    let inserted = 0;
    let duplicates = 0;
    
    for (const sitrep of sitreps) {
      const event = {
        title: sitrep.title,
        summary: sitrep.summary || sitrep.title,
        country: sitrep.country || 'Unknown',
        region: sitrep.region || sitrep.city || 'Unknown',
        city: sitrep.city || null,
        coordinates: null,
        timestamp: sitrep.timestamp || new Date().toISOString(),
        severity: sitrep.severity || 'medium',
        event_type: sitrep.event_type || 'conflict',
        channel: 'news',
        source_urls: [sitrep.url].filter(Boolean),
        reliability_score: 7,
        escalation_score: sitrep.severity === 'critical' ? 9 : 7,
        content_hash: await generateEventHash(sitrep)
      };

      // Check for duplicates
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('content_hash', event.content_hash)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('events')
          .insert([event]);
        
        if (!error) {
          inserted++;
        }
      } else {
        duplicates++;
      }
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        sources: RSS_SOURCES.length,
        articlesProcessed: allArticles.length,
        sitrepsExtracted: sitreps.length,
        eventsInserted: inserted,
        duplicatesSkipped: duplicates
      }
    };

    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Ingestion error:', error);
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