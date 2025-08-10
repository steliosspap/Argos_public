#!/usr/bin/env node

/**
 * Fixed Test Script for Two-Round Search Concept
 * Handles JSON parsing issues with GPT responses
 */

import dotenv from 'dotenv';
import { google } from 'googleapis';
import OpenAI from 'openai';

// Load environment
dotenv.config({ path: '../.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const customsearch = google.customsearch('v1');

// Simple configuration
const CONFIG = {
  googleApiKey: process.env.GOOGLE_API_KEY,
  searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
  openaiModel: 'gpt-4o-mini', // Cheaper for testing
};

class TwoRoundSearchTest {
  constructor() {
    this.round1Results = [];
    this.extractedEvents = [];
    this.round2Results = [];
  }

  async runTest() {
    console.log('=== TWO-ROUND SEARCH TEST (FIXED) ===\n');

    try {
      // ROUND 1: Broad Discovery Search
      console.log('ROUND 1: Executing broad search...');
      await this.executeRound1();
      
      // EXTRACT: Use AI to extract specific events
      console.log('\nEXTRACTION: Analyzing Round 1 results...');
      await this.extractEvents();
      
      // ROUND 2: Targeted searches for each event
      console.log('\nROUND 2: Executing targeted searches...');
      await this.executeRound2();
      
      // COMPARE: Show the difference
      this.compareResults();
      
    } catch (error) {
      console.error('Test failed:', error.message);
    }
  }

  async executeRound1() {
    // Simple broad queries
    const broadQueries = [
      'Ukraine military conflict today',
      'Gaza Israel news latest',
      'breaking news military attack'
    ];

    for (const query of broadQueries) {
      console.log(`  Searching: "${query}"`);
      
      try {
        const response = await customsearch.cse.list({
          auth: CONFIG.googleApiKey,
          cx: CONFIG.searchEngineId,
          q: query,
          num: 5, // Just 5 results for testing
        });

        if (response.data.items) {
          this.round1Results.push(...response.data.items.map(item => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
            query: query,
            round: 1
          })));
        }
      } catch (error) {
        console.error(`  Error searching "${query}":`, error.message);
      }
    }

    console.log(`  Found ${this.round1Results.length} articles in Round 1`);
  }

  async extractEvents() {
    // Combine all Round 1 results for analysis
    const combinedText = this.round1Results
      .map(r => `Title: ${r.title}\nSnippet: ${r.snippet}`)
      .join('\n\n');

    const prompt = `Analyze these news snippets and extract specific conflict events.
For each distinct event found, provide:
1. A one-line description
2. Specific location (city/region)
3. Date/time if mentioned
4. Key actors involved
5. Type of event (attack, bombing, etc.)

Return ONLY valid JSON with an "events" array. No markdown formatting, no code blocks, just JSON.

News snippets:
${combinedText}`;

    try {
      const response = await openai.chat.completions.create({
        model: CONFIG.openaiModel,
        messages: [
          { role: 'system', content: 'You are a conflict event extractor. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      this.extractedEvents = parsed.events || [];
      
      console.log(`  Extracted ${this.extractedEvents.length} specific events:`);
      this.extractedEvents.forEach((event, i) => {
        console.log(`    ${i + 1}. ${event.description || 'Unknown event'}`);
      });
      
    } catch (error) {
      console.error('  Failed to extract events:', error.message);
      // Create a dummy event for testing
      this.extractedEvents = [{
        description: 'Military conflict in Eastern Europe',
        location: 'Ukraine',
        actors: ['Ukraine', 'Russia'],
        type: 'military conflict'
      }];
    }
  }

  cleanJsonResponse(response) {
    // Remove markdown code blocks if present
    let cleaned = response;
    
    // Remove ```json and ``` markers
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  async executeRound2() {
    // Generate specific queries for each extracted event
    for (const event of this.extractedEvents.slice(0, 3)) { // Limit to 3 events
      console.log(`\n  Generating targeted queries for: ${event.description}`);
      
      // Use AI to generate specific search queries
      const searchQueries = await this.generateTargetedQueries(event);
      
      // Execute each targeted query
      for (const query of searchQueries) {
        console.log(`    Searching: "${query}"`);
        
        try {
          const response = await customsearch.cse.list({
            auth: CONFIG.googleApiKey,
            cx: CONFIG.searchEngineId,
            q: query,
            num: 3, // Fewer but more targeted
          });

          if (response.data.items) {
            this.round2Results.push(...response.data.items.map(item => ({
              title: item.title,
              snippet: item.snippet,
              link: item.link,
              query: query,
              round: 2,
              event: event.description
            })));
          }
        } catch (error) {
          console.error(`    Error with query:`, error.message);
        }
      }
    }

    console.log(`\n  Found ${this.round2Results.length} articles in Round 2`);
  }

  async generateTargetedQueries(event) {
    const prompt = `Generate 3 specific search queries for this event:
Event: ${event.description}
Location: ${event.location || 'Unknown'}
Actors: ${(event.actors || []).join(', ')}
Type: ${event.type || 'Unknown'}

Create highly specific queries that would find more information about this exact event.
Return ONLY a JSON array of query strings. No markdown, no code blocks, just the array.

Example: ["specific query 1", "specific query 2", "specific query 3"]`;

    try {
      const response = await openai.chat.completions.create({
        model: CONFIG.openaiModel,
        messages: [
          { role: 'system', content: 'Generate search queries. Return only a JSON array of strings.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
      });

      const cleanedResponse = this.cleanJsonResponse(response.choices[0].message.content);
      const queries = JSON.parse(cleanedResponse);
      
      if (Array.isArray(queries)) {
        console.log(`    Generated ${queries.length} queries successfully`);
        return queries.slice(0, 3);
      } else {
        throw new Error('Response is not an array');
      }
      
    } catch (error) {
      console.error('    Failed to generate queries:', error.message);
      // Fallback queries
      return [
        `${event.location} ${event.type}`,
        `${event.description} latest news`,
        event.actors ? `${event.actors[0]} ${event.location}` : event.description
      ];
    }
  }

  compareResults() {
    console.log('\n=== RESULTS COMPARISON ===\n');
    
    console.log('ROUND 1 (Broad Search):');
    console.log(`  Total articles: ${this.round1Results.length}`);
    console.log('  Sample titles:');
    this.round1Results.slice(0, 3).forEach(r => {
      console.log(`    - ${r.title}`);
    });
    
    console.log('\nEXTRACTED EVENTS:');
    this.extractedEvents.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.description}`);
      if (event.location) console.log(`     Location: ${event.location}`);
      if (event.actors) console.log(`     Actors: ${event.actors.join(', ')}`);
    });
    
    console.log('\nROUND 2 (Targeted Search):');
    console.log(`  Total articles: ${this.round2Results.length}`);
    console.log('  Sample titles:');
    this.round2Results.slice(0, 3).forEach(r => {
      console.log(`    - ${r.title}`);
      console.log(`      (Event: ${r.event})`);
    });
    
    // Check for overlap
    const round1Links = new Set(this.round1Results.map(r => r.link));
    const round2Links = new Set(this.round2Results.map(r => r.link));
    const overlap = [...round2Links].filter(link => round1Links.has(link));
    
    console.log('\nANALYSIS:');
    console.log(`  Unique to Round 2: ${round2Links.size - overlap.length} articles`);
    console.log(`  Overlap: ${overlap.length} articles`);
    console.log(`  Efficiency: Round 2 found ${((round2Links.size - overlap.length) / round2Links.size * 100).toFixed(1)}% new content`);
    
    console.log('\nKEY INSIGHT:');
    console.log('  Round 1 gives us BROAD coverage to discover events');
    console.log('  Round 2 gives us DEEP coverage of each specific event');
    console.log('  Together they provide comprehensive conflict monitoring');
  }
}

// Run the test
console.log('Starting Two-Round Search Test (Fixed Version)...\n');
console.log('This test will:');
console.log('1. Do broad searches (Round 1)');
console.log('2. Extract specific events using AI');
console.log('3. Generate targeted searches (Round 2)');
console.log('4. Compare results\n');

const test = new TwoRoundSearchTest();
test.runTest();