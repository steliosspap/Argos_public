#!/usr/bin/env node

import { classifyContentRelevance } from '../osint-ingestion/nlp/classifyContent.js';

// Test some actual headlines from recent news
const testArticles = [
  {
    title: "Iran demands accountability for Israel and US after 'war of aggression'",
    summary: "Israel launched a surprise attack on Iran"
  },
  {
    title: "Ukraine's sovereignty was violated long before Trump",
    summary: "For years, governments in Kyiv have been pressured"
  },
  {
    title: "Gunboats target cargo vessel in Red Sea; crew abandons ship",
    summary: "The vessel is reportedly taking on water"
  },
  {
    title: "Brazil's leader Lula condemns Gaza 'genocide' at BRICS",
    summary: "BRICS nations have been in disagreement over"
  },
  {
    title: "Hezbollah chief says won't disarm until Israel leaves southern Lebanon",
    summary: "Naim Qassem says his group will"
  },
  {
    title: "Why has Iran stepped up its deportation of Afghan refugees",
    summary: "Thousands are being forced to go back to"
  },
  {
    title: "Russia launches missile attack on Ukrainian cities",
    summary: "Multiple explosions reported in Kyiv and Kharkiv"
  },
  {
    title: "NATO increases military presence near Russian border",
    summary: "Alliance responds to increased tensions"
  }
];

console.log('Content Classification Test\n');
console.log('Default threshold: 0.4\n');

let relevantCount = 0;
let irrelevantCount = 0;

testArticles.forEach((article, index) => {
  const result = classifyContentRelevance(article.title, article.summary);
  
  console.log(`${index + 1}. ${article.title}`);
  console.log(`   Summary: ${article.summary}`);
  console.log(`   Relevant: ${result.isRelevant ? '✓' : '✗'}`);
  console.log(`   Confidence: ${result.confidence.toFixed(2)}`);
  console.log(`   Categories: ${result.categories.join(', ') || 'none'}`);
  console.log(`   Reasoning: ${result.reasoning || 'none'}`);
  console.log('');
  
  if (result.isRelevant) {
    relevantCount++;
  } else {
    irrelevantCount++;
  }
});

console.log('\nSummary:');
console.log(`Relevant articles: ${relevantCount}/${testArticles.length}`);
console.log(`Filtered out: ${irrelevantCount}/${testArticles.length}`);
console.log(`\nThis explains why only ${relevantCount} out of ${testArticles.length} articles pass the filter.`);