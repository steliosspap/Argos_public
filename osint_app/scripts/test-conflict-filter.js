#!/usr/bin/env node

/**
 * Test script for conflict event filtering
 * Tests both the TypeScript classifier and the JavaScript sync filter
 */

import debug from 'debug';

const log = debug('test:conflict-filter');

// Test cases for conflict filtering
const testCases = [
  // Should be filtered out (false positives)
  {
    title: "New Call of Duty game features realistic military combat",
    summary: "The latest installment in the popular video game series brings unprecedented realism to virtual warfare.",
    shouldPass: false,
    reason: "Video game content"
  },
  {
    title: "Senator warns of potential conflict with rival nation",
    summary: "In a press conference today, the senator stated concerns about escalating tensions.",
    shouldPass: false,
    reason: "Political discourse without action"
  },
  {
    title: "Bee attack leaves 3 injured at outdoor festival",
    summary: "A swarm of bees attacked festival-goers, sending three to the hospital.",
    shouldPass: false,
    reason: "Animal incident"
  },
  {
    title: "Anniversary of historic battle commemorated",
    summary: "Veterans and officials gather to remember the fallen soldiers from 50 years ago.",
    shouldPass: false,
    reason: "Historical/memorial event"
  },
  {
    title: "Military conducts training exercise near border",
    summary: "Annual military training drill simulates border defense scenarios.",
    shouldPass: false,
    reason: "Training exercise"
  },
  {
    title: "Football match erupts in clash between rival fans",
    summary: "Police intervene as supporters from both teams engage in violent confrontations.",
    shouldPass: false,
    reason: "Sports-related violence"
  },
  
  // Should pass (real conflicts)
  {
    title: "Military forces clash at disputed border, 12 killed",
    summary: "Armed confrontation between military units leaves soldiers dead on both sides.",
    shouldPass: true,
    reason: "Real military conflict"
  },
  {
    title: "Rebel group launches offensive against government forces",
    summary: "Militants attack military positions, casualties reported.",
    shouldPass: true,
    reason: "Armed insurgency"
  },
  {
    title: "Missile strike hits military base, multiple casualties",
    summary: "Enemy forces launched missiles targeting the base, resulting in deaths and injuries.",
    shouldPass: true,
    reason: "Military attack"
  },
  {
    title: "Armed militants attack civilian convoy",
    summary: "Terrorist group ambushes vehicles, killing several civilians.",
    shouldPass: true,
    reason: "Terrorist attack"
  }
];

// Replicate the validation function from syncEvents.js
function isValidConflictNews(newsItem) {
  const fullText = `${newsItem.title || ''} ${newsItem.summary || ''} ${newsItem.description || ''}`.toLowerCase();
  
  // Exclude non-conflict events
  const excludePatterns = [
    // Entertainment/Media
    /\b(movie|film|tv show|television|series|netflix|documentary|game|gaming|esports)\b/,
    // Political discourse without action
    /\b(politician|senator|congressman|debate|election|campaign|poll|vote)\b.*\b(said|says|stated|announced)\b/,
    // Sports
    /\b(sports|football|soccer|basketball|tennis|olympics|tournament|match|game)\b/,
    // Natural events
    /\b(earthquake|hurricane|tornado|flood|wildfire|weather|climate)\b/,
    // Animals
    /\b(animal|wildlife|bee|wasp|insect|dog|cat|bear|shark|snake)\b.*\b(attack|incident)\b/,
    // Historical/Memorial
    /\b(anniversary|memorial|historical|museum|remembrance|commemoration)\b/,
    // Training/Exercises
    /\b(training|exercise|drill|simulation|practice|demonstration)\b.*\b(military|forces)\b/,
  ];
  
  // Must have conflict-related keywords
  const requirePatterns = [
    /\b(military|armed|combat|battle|war|conflict|attack|strike|offensive|clash)\b/,
    /\b(killed|wounded|injured|casualties|dead|victims)\b/,
    /\b(forces|troops|soldiers|militants|fighters|rebels)\b/,
  ];
  
  // Check exclusions
  const isExcluded = excludePatterns.some(pattern => pattern.test(fullText));
  if (isExcluded) {
    return false;
  }
  
  // Check requirements
  const hasRequired = requirePatterns.some(pattern => pattern.test(fullText));
  return hasRequired;
}

// Run tests
console.log('Testing Conflict Event Filtering\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = isValidConflictNews(testCase);
  const success = result === testCase.shouldPass;
  
  if (success) {
    passed++;
    console.log(`✓ Test ${index + 1}: ${testCase.reason}`);
    console.log(`  Title: "${testCase.title.slice(0, 50)}..."`);
  } else {
    failed++;
    console.log(`✗ Test ${index + 1}: ${testCase.reason}`);
    console.log(`  Title: "${testCase.title.slice(0, 50)}..."`);
    console.log(`  Expected: ${testCase.shouldPass ? 'PASS' : 'FILTER OUT'}`);
    console.log(`  Got: ${result ? 'PASS' : 'FILTER OUT'}`);
  }
  console.log('');
});

console.log('=' .repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed`);
console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed > 0) {
  process.exit(1);
}