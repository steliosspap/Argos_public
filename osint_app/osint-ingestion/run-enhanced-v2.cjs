#!/usr/bin/env node

/**
 * Enhanced Two-Round Ingestion V2
 * Stores discovery metadata in tags field
 */

require('dotenv').config({ path: '../.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const OpenAI = require('openai');
const crypto = require('crypto');

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const customSearch = google.customsearch('v1');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runEnhancedIngestion() {
  console.log('🚀 Starting Enhanced Two-Round Ingestion V2...\n');
  console.log('📝 Note: Storing discovery metadata in tags field\n');
  
  const stats = {
    round1: { searched: 0, analyzed: 0, conflicts: 0 },
    round2: { searched: 0, analyzed: 0, conflicts: 0 },
    stored: 0,
    errors: []
  };
  
  try {
    // ROUND 1: Broad Discovery
    console.log('🔍 ROUND 1: Broad Discovery Search...');
    const round1Articles = await performBroadSearch(stats);
    const round1Events = await analyzeArticles(round1Articles, 1, stats);
    
    console.log(`   ✓ Found ${round1Events.length} conflicts in Round 1\n`);
    
    if (round1Events.length === 0) {
      console.log('⚠️  No conflicts found in Round 1, skipping Round 2');
      return;
    }
    
    // Extract entities
    console.log('🧠 Extracting entities for targeted search...');
    const entities = extractEntities(round1Events);
    console.log(`   ✓ Extracted: ${entities.locations.length} locations, ${entities.actors.length} actors\n`);
    
    // ROUND 2: Targeted Deep Search
    console.log('🎯 ROUND 2: Targeted Deep Search...');
    const round2Articles = await performTargetedSearch(entities, stats);
    const round2Events = await analyzeArticles(round2Articles, 2, stats);
    
    console.log(`   ✓ Found ${round2Events.length} additional conflicts in Round 2\n`);
    
    // Store all events
    console.log('💾 Storing events to database...');
    await storeEvents([...round1Events, ...round2Events], stats);
    
    // Calculate effectiveness
    const coverageBoost = round1Events.length > 0 
      ? ((round2Events.length / round1Events.length) * 100).toFixed(1)
      : 0;
    
    console.log('\n✅ INGESTION COMPLETE!');
    console.log('📊 Results:');
    console.log(`   - Round 1: ${round1Events.length} conflicts found`);
    console.log(`   - Round 2: ${round2Events.length} additional conflicts`);
    console.log(`   - Coverage Boost: ${coverageBoost}% more content`);
    console.log(`   - Total Events: ${round1Events.length + round2Events.length}`);
    console.log(`   - Stored to Database: ${stats.stored}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Perform broad search
async function performBroadSearch(stats) {
  const queries = [
    'Ukraine Russia military conflict latest',
    'Gaza Israel Hamas military operations today',
    'Syria military strikes latest news',
    'Yemen conflict updates today',
    'Taiwan China military tensions'
  ];
  
  const articles = [];
  
  for (const query of queries) {
    try {
      console.log(`   Searching: "${query}"`);
      
      const response = await customSearch.cse.list({
        auth: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 10,
        dateRestrict: 'd1'
      });
      
      if (response.data.items) {
        articles.push(...response.data.items.map(item => ({
          ...item,
          discovery_round: 1,
          query
        })));
        stats.round1.searched += response.data.items.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      stats.errors.push(`Search failed: ${error.message}`);
    }
  }
  
  return articles;
}

// Perform targeted search based on extracted entities
async function performTargetedSearch(entities, stats) {
  const articles = [];
  const queries = [];
  
  // Generate smart targeted queries
  entities.locations.slice(0, 3).forEach(location => {
    entities.actors.slice(0, 2).forEach(actor => {
      queries.push(`${location} ${actor} military operations latest`);
    });
  });
  
  // Add keyword-based queries
  entities.keywords.slice(0, 5).forEach(keyword => {
    queries.push(`${keyword} conflict military latest`);
  });
  
  for (const query of queries.slice(0, 10)) {
    try {
      console.log(`   Searching: "${query}"`);
      
      const response = await customSearch.cse.list({
        auth: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 5,
        dateRestrict: 'd1'
      });
      
      if (response.data.items) {
        articles.push(...response.data.items.map(item => ({
          ...item,
          discovery_round: 2,
          query
        })));
        stats.round2.searched += response.data.items.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      stats.errors.push(`Targeted search failed: ${error.message}`);
    }
  }
  
  return articles;
}

// Analyze articles with GPT
async function analyzeArticles(articles, round, stats) {
  const events = [];
  
  console.log(`   Analyzing ${articles.length} articles with GPT-4o...`);
  
  for (const article of articles) {
    try {
      const analysis = await analyzeWithGPT(article);
      if (analysis && analysis.is_conflict !== false) {
        const event = createEventFromAnalysis(article, analysis, round);
        events.push(event);
        stats[`round${round}`].conflicts++;
      }
      stats[`round${round}`].analyzed++;
      
      // Progress indicator
      if (stats[`round${round}`].analyzed % 5 === 0) {
        console.log(`   ... analyzed ${stats[`round${round}`].analyzed}/${articles.length}`);
      }
    } catch (error) {
      stats.errors.push(`Analysis failed: ${error.message}`);
    }
  }
  
  return events;
}

// Analyze single article with GPT
async function analyzeWithGPT(article) {
  const prompt = `Analyze this news article for military/conflict relevance:
Title: ${article.title}
Source: ${article.displayLink}
Snippet: ${article.snippet}

Return JSON with:
- is_conflict: boolean (true if military/conflict related)
- conflict_type: string (armed_conflict, terrorism, military_operation, etc.)
- location: {country: string, city: string}
- severity: string (low, medium, high, critical)
- actors: string[] (main parties involved)
- key_events: string[] (what happened)`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a conflict analysis expert. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content || '{}');
}

// Create event from GPT analysis
function createEventFromAnalysis(article, analysis, round) {
  const reliability = calculateSourceReliability(article.displayLink);
  
  return {
    title: article.title,
    summary: article.snippet + (analysis.key_events ? '\n\nKey events: ' + analysis.key_events.join('; ') : ''),
    source_url: article.link,
    timestamp: new Date(),
    source: article.displayLink,
    event_type: analysis.conflict_type || 'unknown',
    severity: analysis.severity || 'medium',
    country: analysis.location?.country || 'Unknown',
    city: analysis.location?.city,
    participants: analysis.actors || [],
    content_hash: crypto.createHash('sha256').update(article.link).digest('hex'),
    // Store enhanced metadata in tags
    tags: [
      `discovery:round${round}`,
      `reliability:${Math.round(reliability * 100)}`,
      analysis.conflict_type,
      `severity:${analysis.severity}`,
      ...analysis.actors?.map(a => `actor:${a.toLowerCase().replace(/\s+/g, '_')}`) || [],
      `source:${article.displayLink.replace(/\./g, '_')}`
    ].filter(Boolean)
  };
}

// Extract entities from events
function extractEntities(events) {
  const entities = {
    locations: new Set(),
    actors: new Set(),
    keywords: new Set()
  };
  
  events.forEach(event => {
    if (event.country && event.country !== 'Unknown') {
      entities.locations.add(event.country);
    }
    if (event.city) {
      entities.locations.add(event.city);
    }
    event.participants?.forEach(actor => entities.actors.add(actor));
    
    // Extract keywords from summaries
    const words = event.summary.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 5 && !['military', 'conflict', 'attack'].includes(word)) {
        entities.keywords.add(word);
      }
    });
  });
  
  return {
    locations: Array.from(entities.locations),
    actors: Array.from(entities.actors),
    keywords: Array.from(entities.keywords).slice(0, 10)
  };
}

// Calculate source reliability
function calculateSourceReliability(source) {
  const reliableSource = {
    'reuters.com': 0.95,
    'apnews.com': 0.95,
    'bbc.com': 0.90,
    'bbc.co.uk': 0.90,
    'cnn.com': 0.80,
    'aljazeera.com': 0.85,
    'nytimes.com': 0.90,
    'theguardian.com': 0.85,
    'bloomberg.com': 0.85
  };
  
  for (const [domain, score] of Object.entries(reliableSource)) {
    if (source.includes(domain)) return score;
  }
  return 0.60; // Default reliability
}

// Store events to database
async function storeEvents(events, stats) {
  for (const event of events) {
    try {
      // Check for duplicates
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('content_hash', event.content_hash)
        .maybeSingle();
      
      if (!existing) {
        const { error } = await supabase
          .from('events')
          .insert(event);
        
        if (!error) {
          stats.stored++;
          console.log(`   ✓ Stored: ${event.title.substring(0, 50)}...`);
        } else {
          throw error;
        }
      } else {
        console.log(`   - Duplicate: ${event.title.substring(0, 50)}...`);
      }
    } catch (error) {
      stats.errors.push(`Store failed: ${error.message}`);
      console.error(`   ✗ Failed to store: ${error.message}`);
    }
  }
}

// Run the ingestion
runEnhancedIngestion();