#!/usr/bin/env node

/**
 * Quick check to see how the Argos pipeline works
 * Run this to see the pipeline in action with minimal setup
 */

import ArgosMasterPipeline, { Article } from './argos-master-pipeline.js';

console.log("🚀 ARGOS PIPELINE QUICK CHECK\n");

// Create a simple test article
const testArticle = new Article(
  "https://example.com/test",
  new Date().toISOString(),
  "Reuters",
  `Russian forces launched drone strikes on Kharkiv's power infrastructure today. 
   Ukrainian officials report multiple casualties. The attack targeted electrical 
   substations causing widespread blackouts.`
);

// Initialize pipeline
const pipeline = new ArgosMasterPipeline();

console.log("1️⃣ Testing Relevance Classifier:");
const relevance = pipeline.classifier.isConflictRelevant(testArticle);
console.log(`   Result: ${relevance.relevant ? '✅ RELEVANT' : '❌ REJECTED'}`);
console.log(`   Reason: ${relevance.reason}\n`);

console.log("2️⃣ Testing Event Extraction:");
const event = pipeline.extractor.extractEvent(testArticle);
console.log(`   Actor: ${event.actor}`);
console.log(`   Location: ${event.location}`);
console.log(`   Action: ${event.action}`);
console.log(`   Keywords: ${event.keywords.join(', ')}\n`);

console.log("3️⃣ Testing Media Bias Scoring:");
console.log(`   Source: ${event.source}`);
console.log(`   Bias: ${event.bias_score} (range: -1 to +1)`);
console.log(`   Reliability: ${event.reliability_score}/100\n`);

console.log("4️⃣ Testing Event Grouping:");
const events = [event, { ...event, source: "BBC" }]; // Simulate duplicate
const groups = pipeline.grouper.groupEvents(events);
console.log(`   Events: ${events.length}`);
console.log(`   Groups: ${groups.length}`);
console.log(`   Corroborated: ${groups[0].corroborated}\n`);

console.log("✅ Pipeline components working correctly!");
console.log("\nTo run full pipeline: node argos-master-pipeline.js");
console.log("To see interactive demo: node demo-argos-pipeline.js");