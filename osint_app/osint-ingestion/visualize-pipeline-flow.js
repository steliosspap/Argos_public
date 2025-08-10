#!/usr/bin/env node

/**
 * Visualize the Argos pipeline flow
 * Shows how data flows through each phase
 */

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    ARGOS PIPELINE DATA FLOW                           ║
╚═══════════════════════════════════════════════════════════════════════╝

┌─────────────────────┐
│   ROUND 1 SEARCH    │ ← 220 queries (20 subjects × 11 modifiers)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ARTICLE INGESTION   │ ← Articles with URL, date, source, content
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   DEDUPLICATION     │ ← Remove duplicates by hash/URL
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ RELEVANCE FILTER    │ ← Reject sports, entertainment, non-conflict
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  EVENT EXTRACTION   │ ← Extract: actor, location, action, target
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   EVENT GROUPING    │ ← Group similar events (fuzzy matching)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ KEYWORD EXTRACTION  │ ← Extract keywords for Round 2
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   ROUND 2 SEARCH    │ ← subject + keyword + modifier queries
└──────────┬──────────┘
           │
           ▼
    [Repeat phases 2-6]
           │
           ▼
┌─────────────────────┐
│   MEDIA SCORING     │ ← Apply bias & reliability scores
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ HEADLINE GENERATION │ ← Create summary headlines
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SUPABASE EXPORT    │ ← Upload events, groups, articles
└─────────────────────┘

═══════════════════════════════════════════════════════════════════════

EXAMPLE DATA TRANSFORMATION:

INPUT: "Russian forces launched drone strikes on Kharkiv..."

PHASE 3 → Relevant: ✅ (Contains "Russian forces", weapon terms)

PHASE 4 → Event: {
  actor: "Russian forces",
  location: "Kharkiv",
  action: "launched drone strikes",
  target: "power infrastructure",
  keywords: ["Russian forces", "Kharkiv", "drone"]
}

PHASE 5 → Group: {
  events: [event1, event2],  // If similar events found
  corroborated: true,
  avg_reliability: 92.5
}

PHASE 6 → Round 2 Queries:
  - "Ukraine frontline Kharkiv breaking"
  - "Ukraine frontline drone update"
  - "Ukraine frontline Russian forces casualties"

OUTPUT: Structured, grouped, scored conflict events ready for analysis
`);