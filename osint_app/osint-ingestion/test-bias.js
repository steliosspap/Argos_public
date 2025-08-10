#!/usr/bin/env node

/**
 * Test Media Bias Analyzer
 */

import { MediaBiasAnalyzer } from './services/MediaBiasAnalyzer.js';

async function testBiasAnalyzer() {
  const analyzer = new MediaBiasAnalyzer();
  
  // Test articles from different sources
  const testArticles = [
    {
      title: "Biden Administration Announces New Climate Initiative to Combat Global Warming",
      snippet: "The Biden administration unveiled a comprehensive climate plan today, emphasizing social justice and inequality concerns. Progressive activists praised the move as essential to combat the climate crisis.",
      source: "CNN",
      publishedDate: new Date()
    },
    {
      title: "Trump Defends Traditional Values at Conservative Rally",
      snippet: "Former President Trump stood firm on traditional values and border security at a patriotic rally. He defended gun rights and religious freedom while warning about the radical left's agenda.",
      source: "Fox News",
      publishedDate: new Date()
    },
    {
      title: "Congress Debates Infrastructure Bill with Bipartisan Support",
      snippet: "Members of Congress from both sides announced progress on infrastructure legislation. The debate continues as opinions differ on funding mechanisms, according to officials.",
      source: "Reuters",
      publishedDate: new Date()
    },
    {
      title: "Breaking: Explosion Rocks Damascus as Crisis Deepens",
      snippet: "A shocking explosion in Damascus has created chaos in the Syrian capital. Sources claim the blast was allegedly caused by militants, though details remain unclear.",
      source: "Daily Mail",
      publishedDate: new Date()
    },
    {
      title: "Economic Report Shows Mixed Results for Q3",
      snippet: "The latest economic data reveals both positive and negative indicators for the third quarter. Economists stated that inflation remains a concern while employment shows improvement.",
      source: "BBC News",
      publishedDate: new Date()
    }
  ];
  
  console.log('🔍 Testing Media Bias Analyzer\n');
  console.log('Analyzing articles with verbose output for first article only...\n');
  
  // Analyze articles
  const results = [];
  for (let i = 0; i < testArticles.length; i++) {
    const article = testArticles[i];
    const verbose = i === 0; // Only verbose for first article
    const analysis = await analyzer.analyzeArticleBias(article, verbose);
    results.push(analysis);
  }
  
  // Show batch results
  const batchAnalysis = await analyzer.analyzeBatch(testArticles, false);
  
  // Show individual results summary
  console.log('\n📋 Individual Article Results:');
  console.log('━'.repeat(80));
  console.log('Source'.padEnd(20) + 'Title'.padEnd(40) + 'Bias'.padEnd(10) + 'Score'.padEnd(8) + 'Confidence');
  console.log('─'.repeat(80));
  
  for (const result of results) {
    const title = result.title.length > 37 ? result.title.substring(0, 37) + '...' : result.title;
    console.log(
      result.source.padEnd(20) +
      title.padEnd(40) +
      result.biasAnalysis.label.padEnd(10) +
      result.biasAnalysis.score.toFixed(2).padEnd(8) +
      (result.biasAnalysis.confidence * 100).toFixed(0) + '%'
    );
  }
  
  console.log('━'.repeat(80));
}

testBiasAnalyzer().catch(console.error);