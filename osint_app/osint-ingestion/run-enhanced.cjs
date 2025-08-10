#!/usr/bin/env node

/**
 * Run the Enhanced Two-Round Ingestion
 */

require('dotenv').config({ path: '../.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const OpenAI = require('openai');
const crypto = require('crypto');

// Verify environment variables
console.log('🔍 Checking environment variables...');
const requiredVars = ['GOOGLE_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID', 'OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('❌ Missing environment variables:', missing);
  process.exit(1);
}
console.log('✅ All environment variables loaded\n');

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const customSearch = google.customsearch('v1');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Main function
async function runEnhancedIngestion() {
  console.log('🚀 Starting Enhanced Two-Round Ingestion...\n');
  
  const stats = {
    round1: { searched: 0, analyzed: 0, conflicts: 0 },
    round2: { searched: 0, analyzed: 0, conflicts: 0 },
    stored: 0,
    errors: []
  };
  
  try {
    // Log start
    await logQuery('Enhanced ingestion started', 'ingestion_run', 0);
    
    // ROUND 1: Broad Discovery
    console.log('🔍 ROUND 1: Broad Discovery Search...');
    const round1Articles = await performBroadSearch(stats);
    const round1Events = await analyzeArticles(round1Articles, 1, stats);
    
    console.log(`   ✓ Found ${round1Events.length} conflicts in Round 1\n`);
    
    // Extract entities
    console.log('🧠 Extracting entities for targeted search...');
    const entities = extractEntities(round1Events);
    console.log(`   ✓ Extracted: ${entities.locations.length} locations, ${entities.actors.length} actors\n`);
    
    // ROUND 2: Targeted Deep Search
    console.log('🎯 ROUND 2: Targeted Deep Search...');
    const round2Articles = await performTargetedSearch(entities, stats);
    const round2Events = await analyzeArticles(round2Articles, 2, stats);
    
    console.log(`   ✓ Found ${round2Events.length} additional conflicts in Round 2\n`);
    
    // Combine and store
    const allEvents = [...round1Events, ...round2Events];
    const uniqueEvents = deduplicateEvents(allEvents);
    
    console.log('💾 Storing events to database...');
    await storeEvents(uniqueEvents, stats);
    
    // Log completion
    const coverageBoost = round1Events.length > 0 
      ? ((round2Events.length / round1Events.length) * 100).toFixed(1)
      : 0;
    
    await logQuery(
      `Completed - R1: ${round1Events.length}, R2: ${round2Events.length}, Total: ${uniqueEvents.length}`,
      'ingestion_complete',
      2,
      uniqueEvents.length
    );
    
    console.log('\n✅ INGESTION COMPLETE!');
    console.log('📊 Results:');
    console.log(`   - Round 1: ${round1Events.length} conflicts found`);
    console.log(`   - Round 2: ${round2Events.length} additional conflicts`);
    console.log(`   - Coverage Boost: ${coverageBoost}% more content`);
    console.log(`   - Total Unique Events: ${uniqueEvents.length}`);
    console.log(`   - Stored to Database: ${stats.stored}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  ${stats.errors.length} errors occurred`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await logQuery('Ingestion failed', 'ingestion_error', 0, 0, false, error.message);
  }
}

// Perform broad search
async function performBroadSearch(stats) {
  const queries = [
    'military conflict breaking news today',
    'armed clashes latest updates',
    'war developments today',
    'Gaza Israel military operations',
    'Ukraine Russia conflict latest'
  ];
  
  const articles = [];
  
  for (const query of queries) {
    try {
      console.log(`   Searching: "${query}"`);
      await logQuery(query, 'broad', 1);
      
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
        await logQuery(query, 'broad', 1, response.data.items.length, true);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      stats.errors.push(`Search failed: ${error.message}`);
      await logQuery(query, 'broad', 1, 0, false, error.message);
    }
  }
  
  return articles;
}

// Perform targeted search
async function performTargetedSearch(entities, stats) {
  const articles = [];
  const queries = [];
  
  // Generate targeted queries
  entities.locations.slice(0, 3).forEach(location => {
    entities.actors.slice(0, 2).forEach(actor => {
      queries.push(`${location} ${actor} military operations latest`);
    });
  });
  
  for (const query of queries.slice(0, 10)) {
    try {
      console.log(`   Searching: "${query}"`);
      await logQuery(query, 'targeted', 2);
      
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
        await logQuery(query, 'targeted', 2, response.data.items.length, true);
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
    } catch (error) {
      stats.errors.push(`Targeted search failed: ${error.message}`);
      await logQuery(query, 'targeted', 2, 0, false, error.message);
    }
  }
  
  return articles;
}

// Analyze articles with GPT
async function analyzeArticles(articles, round, stats) {
  const events = [];
  
  for (const article of articles) {
    try {
      const analysis = await analyzeWithGPT(article);
      if (analysis && analysis.is_conflict !== false) {
        events.push({
          ...createEventFromAnalysis(article, analysis),
          discovery_round: round,
          source_reliability: calculateSourceReliability(article.displayLink)
        });
        stats[`round${round}`].conflicts++;
      }
      stats[`round${round}`].analyzed++;
    } catch (error) {
      stats.errors.push(`Analysis failed: ${error.message}`);
    }
  }
  
  return events;
}

// Analyze single article
async function analyzeWithGPT(article) {
  const prompt = `Analyze this news article for conflict/military relevance:
Title: ${article.title}
Source: ${article.displayLink}
Snippet: ${article.snippet}

Return JSON with: is_conflict (boolean), conflict_type, location {country, city}, severity, actors[], key_events[]`;

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
function createEventFromAnalysis(article, analysis) {
  return {
    title: article.title,
    summary: article.snippet,
    source_url: article.link,
    timestamp: new Date(),
    source: article.displayLink,
    event_type: analysis.conflict_type || 'unknown',
    severity: analysis.severity || 'medium',
    country: analysis.location?.country || 'Unknown',
    city: analysis.location?.city,
    participants: analysis.actors || [],
    content_hash: crypto.createHash('sha256').update(article.link).digest('hex'),
    tags: [
      analysis.conflict_type,
      `severity:${analysis.severity}`,
      ...analysis.actors?.map(a => `actor:${a.toLowerCase()}`) || []
    ].filter(Boolean)
  };
}

// Extract entities from events
function extractEntities(events) {
  const entities = {
    locations: new Set(),
    actors: new Set()
  };
  
  events.forEach(event => {
    if (event.country) entities.locations.add(event.country);
    if (event.city) entities.locations.add(event.city);
    event.participants?.forEach(actor => entities.actors.add(actor));
  });
  
  return {
    locations: Array.from(entities.locations),
    actors: Array.from(entities.actors)
  };
}

// Deduplicate events
function deduplicateEvents(events) {
  const seen = new Map();
  events.forEach(event => {
    const key = event.content_hash;
    if (!seen.has(key) || event.discovery_round > seen.get(key).discovery_round) {
      seen.set(key, event);
    }
  });
  return Array.from(seen.values());
}

// Calculate source reliability
function calculateSourceReliability(source) {
  const reliableSource = ['reuters.com', 'apnews.com', 'bbc.com', 'cnn.com', 'nytimes.com'];
  return reliableSource.some(s => source.includes(s)) ? 0.85 : 0.60;
}

// Store events to database
async function storeEvents(events, stats) {
  for (const event of events) {
    try {
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
        } else {
          throw error;
        }
      }
    } catch (error) {
      stats.errors.push(`Store failed: ${error.message}`);
    }
  }
}

// Log search query
async function logQuery(query, type, round, count = 0, success = true, error = null) {
  try {
    await supabase.from('search_queries_executed').insert({
      query_text: query,
      query_type: type,
      query_round: round,
      results_count: count,
      success: success,
      error_message: error
    });
  } catch (err) {
    console.error('Log error:', err.message);
  }
}

// Run the ingestion
runEnhancedIngestion();