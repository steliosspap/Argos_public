# 🛠️ Argos V2 Implementation Guide

## Quick Start - Transform Your Current Pipeline

### Step 1: Database Setup

Create these tables in Supabase:

```sql
-- 1. Sources (media organizations)
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) UNIQUE NOT NULL,
  website VARCHAR(255),
  country_of_origin VARCHAR(100),
  bias_score DECIMAL(3,2) CHECK (bias_score >= -1 AND bias_score <= 1),
  reliability_score INTEGER CHECK (reliability_score >= 0 AND reliability_score <= 100),
  bias_source VARCHAR(100),
  last_bias_update TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Authors
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) UNIQUE NOT NULL,
  source_id UUID REFERENCES sources(id),
  article_count INTEGER DEFAULT 0,
  inferred_bias_score DECIMAL(3,2),
  bias_confidence DECIMAL(3,2),
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Articles
CREATE TABLE articles_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT,
  content TEXT NOT NULL,
  published_date TIMESTAMP,
  first_detected TIMESTAMP DEFAULT NOW(),
  last_modified TIMESTAMP DEFAULT NOW(),
  source_id UUID REFERENCES sources(id),
  author_ids UUID[] DEFAULT '{}',
  search_round INTEGER,
  search_query TEXT,
  content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Events (MULTIPLE per article!)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles_raw(id) NOT NULL,
  actor VARCHAR(500),
  target VARCHAR(500),
  location VARCHAR(255),
  action VARCHAR(500),
  estimated_date TIMESTAMP,
  temporal_expression VARCHAR(255),
  confidence_interval VARCHAR(100),
  binary_flags JSONB DEFAULT '{}',
  event_category VARCHAR(100),
  event_subcategory VARCHAR(100),
  attribution_source VARCHAR(100),
  attribution_text TEXT,
  sentiment_score DECIMAL(3,2),
  summary TEXT,
  raw_sentence TEXT,
  extraction_confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Named Entities
CREATE TABLE named_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  normalized_name VARCHAR(500) NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  mention_count INTEGER DEFAULT 1,
  source_article_ids UUID[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(normalized_name, type)
);

-- 6. Event-Entity relationships
CREATE TABLE event_named_entities (
  event_id UUID REFERENCES events(id),
  named_entity_id UUID REFERENCES named_entities(id),
  role VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (event_id, named_entity_id, role)
);

-- 7. Event Groups
CREATE TABLE event_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_ids UUID[] NOT NULL,
  primary_event_id UUID REFERENCES events(id),
  group_confidence DECIMAL(3,2),
  corroboration_count INTEGER,
  source_diversity_score DECIMAL(3,2),
  generated_headline TEXT,
  bias_distribution JSONB,
  average_reliability DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_events_article_id ON events(article_id);
CREATE INDEX idx_events_location ON events(location);
CREATE INDEX idx_events_actor ON events(actor);
CREATE INDEX idx_events_estimated_date ON events(estimated_date);
CREATE INDEX idx_named_entities_normalized ON named_entities(normalized_name);
CREATE INDEX idx_articles_source_id ON articles_raw(source_id);
CREATE INDEX idx_articles_published_date ON articles_raw(published_date);
```

### Step 2: Minimal Working Implementation

Start with this basic multi-event extractor:

```javascript
// multi-event-extractor.js
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export class SimpleMultiEventExtractor {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async extractEventsFromArticle(article) {
    const events = [];
    
    // Split into sentences
    const sentences = article.content.split(/[.!?]+/).filter(s => s.trim());
    
    // Simple patterns for multiple events
    const eventPatterns = [
      {
        name: 'military_action',
        pattern: /([A-Z][\w\s]+(?:forces?|military|army|troops|militants?))\s+(?:launched|conducted|carried out|struck|attacked|bombed|shelled)\s+(.+?)(?:\s+in\s+([A-Z][\w\s]+))?/gi,
        extractor: (match) => ({
          actor: match[1].trim(),
          action: 'military action',
          target: match[2].trim(),
          location: match[3]?.trim() || 'unspecified'
        })
      },
      {
        name: 'casualty_report',
        pattern: /(?:at least|about|approximately)?\s*(\d+)\s+(?:people|civilians?|soldiers?)\s+(?:were\s+)?(?:killed|died|wounded|injured)\s+(?:in|during|after)\s+(.+?)(?:\s+in\s+([A-Z][\w\s]+))?/gi,
        extractor: (match) => ({
          actor: 'unspecified',
          action: 'casualty report',
          target: `${match[1]} people`,
          location: match[3]?.trim() || 'unspecified'
        })
      }
    ];

    // Extract events from each sentence
    for (const sentence of sentences) {
      for (const { pattern, extractor } of eventPatterns) {
        const matches = [...sentence.matchAll(pattern)];
        for (const match of matches) {
          const extracted = extractor(match);
          
          // Create event object
          const event = {
            id: uuidv4(),
            article_id: article.id,
            actor: extracted.actor,
            target: extracted.target,
            location: extracted.location,
            action: extracted.action,
            estimated_date: article.published_date,
            temporal_expression: this.extractTemporal(sentence),
            summary: `${extracted.actor} ${extracted.action} targeting ${extracted.target} in ${extracted.location}`,
            raw_sentence: sentence.trim(),
            extraction_confidence: 0.8,
            binary_flags: this.detectEventType(sentence),
            event_category: 'kinetic',
            attribution_source: this.extractAttribution(sentence)
          };
          
          events.push(event);
        }
      }
    }

    // Remove duplicates
    return this.deduplicateEvents(events);
  }

  extractTemporal(sentence) {
    const temporalPatterns = [
      /yesterday/i,
      /today/i,
      /this morning/i,
      /last night/i,
      /(\d+) hours? ago/i
    ];

    for (const pattern of temporalPatterns) {
      const match = sentence.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  detectEventType(sentence) {
    const lower = sentence.toLowerCase();
    return {
      is_airstrike: /air\s?strike|bombing|aerial/i.test(lower),
      is_ground_operation: /ground|infantry|troops/i.test(lower),
      is_artillery: /artillery|shell|mortar/i.test(lower),
      is_drone_strike: /drone|uav|unmanned/i.test(lower),
      has_civilian_casualties: /civilian|innocent|non-combatant/i.test(lower),
      is_ceasefire: /ceasefire|truce|cessation/i.test(lower)
    };
  }

  extractAttribution(sentence) {
    const patterns = [
      /according to (.+?)[,\.]/i,
      /(.+?) (?:said|reported|confirmed)/i,
      /(?:officials?|sources?|witnesses?) (?:said|reported)/i
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) return match[1]?.trim() || 'officials';
    }
    return 'unattributed';
  }

  deduplicateEvents(events) {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.actor}-${event.action}-${event.target}-${event.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
```

### Step 3: Test with Real Articles

```javascript
// test-multi-event.js
import { SimpleMultiEventExtractor } from './multi-event-extractor.js';

const testArticle = {
  id: 'test-123',
  content: `Russian forces launched airstrikes on Kharkiv's power infrastructure yesterday. 
    At least 5 civilians were killed in the attacks according to local officials. 
    Ukrainian forces responded with drone strikes on Russian positions near Belgorod. 
    Meanwhile, diplomatic talks continue in Istanbul as both sides seek a ceasefire agreement.`,
  published_date: new Date().toISOString()
};

const extractor = new SimpleMultiEventExtractor(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const events = await extractor.extractEventsFromArticle(testArticle);

console.log(`Extracted ${events.length} events:`);
events.forEach((event, i) => {
  console.log(`\nEvent ${i + 1}:`);
  console.log(`  Actor: ${event.actor}`);
  console.log(`  Action: ${event.action}`);
  console.log(`  Target: ${event.target}`);
  console.log(`  Location: ${event.location}`);
  console.log(`  Summary: ${event.summary}`);
});
```

### Step 4: Implement Named Entity Registry

```javascript
// named-entity-registry.js
export class NamedEntityRegistry {
  constructor(supabase) {
    this.supabase = supabase;
    this.cache = new Map();
  }

  async extractAndRegisterEntities(event) {
    const entities = [];
    
    // Extract from actor
    if (event.actor && event.actor !== 'unspecified') {
      const actorEntity = await this.registerEntity(
        event.actor, 
        this.classifyEntityType(event.actor),
        event.id,
        'actor'
      );
      entities.push(actorEntity);
    }

    // Extract from location
    if (event.location && event.location !== 'unspecified') {
      const locationEntity = await this.registerEntity(
        event.location,
        'location',
        event.id,
        'location'
      );
      entities.push(locationEntity);
    }

    // Extract from sentence using NER patterns
    const additionalEntities = await this.extractFromText(event.raw_sentence);
    for (const entity of additionalEntities) {
      await this.registerEntity(entity.name, entity.type, event.id, 'mentioned');
      entities.push(entity);
    }

    return entities;
  }

  classifyEntityType(name) {
    const patterns = {
      military: /forces?|army|military|troops|militants?/i,
      organization: /UN|NATO|EU|government|ministry/i,
      weapon: /missile|drone|aircraft|tank|artillery/i,
      person: /president|minister|general|commander/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(name)) return type;
    }
    
    return 'organization'; // default
  }

  async registerEntity(name, type, eventId, role) {
    const normalized = this.normalize(name, type);
    const cacheKey = `${normalized}:${type}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const entity = this.cache.get(cacheKey);
      await this.linkToEvent(entity.id, eventId, role);
      return entity;
    }

    // Check database
    const { data: existing } = await this.supabase
      .from('named_entities')
      .select('*')
      .eq('normalized_name', normalized)
      .eq('type', type)
      .single();

    if (existing) {
      // Update mention count and last seen
      await this.supabase
        .from('named_entities')
        .update({
          mention_count: existing.mention_count + 1,
          last_seen: new Date().toISOString()
        })
        .eq('id', existing.id);

      this.cache.set(cacheKey, existing);
      await this.linkToEvent(existing.id, eventId, role);
      return existing;
    }

    // Create new entity
    const { data: newEntity } = await this.supabase
      .from('named_entities')
      .insert({
        name: name,
        normalized_name: normalized,
        type: type,
        aliases: this.generateAliases(name, type)
      })
      .select()
      .single();

    this.cache.set(cacheKey, newEntity);
    await this.linkToEvent(newEntity.id, eventId, role);
    return newEntity;
  }

  normalize(name, type) {
    // Basic normalization
    let normalized = name.trim().toLowerCase();
    
    // Type-specific normalization
    if (type === 'location') {
      // Remove common suffixes
      normalized = normalized.replace(/ city$| province$| region$/i, '');
    } else if (type === 'military') {
      // Standardize military terms
      normalized = normalized.replace(/forces?/i, 'forces');
    }

    return normalized;
  }

  generateAliases(name, type) {
    const aliases = [];
    
    // Add acronym if applicable
    if (name.includes(' ')) {
      const acronym = name.split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();
      aliases.push(acronym);
    }

    // Add variations
    if (type === 'military') {
      aliases.push(name.replace(/forces/i, 'army'));
      aliases.push(name.replace(/forces/i, 'military'));
    }

    return aliases;
  }

  async linkToEvent(entityId, eventId, role) {
    await this.supabase
      .from('event_named_entities')
      .insert({
        event_id: eventId,
        named_entity_id: entityId,
        role: role
      });
  }
}
```

### Step 5: Create Migration Script

```javascript
// migrate-to-v2.js
import { createClient } from '@supabase/supabase-js';
import { SimpleMultiEventExtractor } from './multi-event-extractor.js';
import { NamedEntityRegistry } from './named-entity-registry.js';

async function migrateExistingData() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  
  const extractor = new SimpleMultiEventExtractor(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  
  const nerRegistry = new NamedEntityRegistry(supabase);

  // Get existing events (from v1 schema)
  const { data: oldEvents } = await supabase
    .from('conflict_events')
    .select('*')
    .order('created_at', { ascending: true });

  console.log(`Migrating ${oldEvents.length} events to new schema...`);

  for (const oldEvent of oldEvents) {
    // Create article if not exists
    const { data: article } = await supabase
      .from('articles_raw')
      .upsert({
        url: oldEvent.source_url,
        content: oldEvent.summary, // or fetch from original source
        published_date: oldEvent.estimated_time,
        source_id: await resolveSource(oldEvent.source_name),
        content_hash: generateHash(oldEvent.summary)
      })
      .select()
      .single();

    // Re-extract events with new extractor
    const newEvents = await extractor.extractEventsFromArticle(article);
    
    // Save events
    for (const event of newEvents) {
      const { data: savedEvent } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single();

      // Extract and register entities
      await nerRegistry.extractAndRegisterEntities(savedEvent);
    }
  }

  console.log('Migration complete!');
}

migrateExistingData().catch(console.error);
```

## 🚀 Immediate Next Steps

1. **Set up the database schema** in Supabase (copy-paste the SQL above)

2. **Test multi-event extraction** with your existing articles:
   ```bash
   node test-multi-event.js
   ```

3. **Migrate your existing data** to see the difference:
   ```bash
   node migrate-to-v2.js
   ```

4. **Add LLM integration** for complex event extraction:
   ```javascript
   // Add to SimpleMultiEventExtractor
   async llmExtractEvents(text) {
     const response = await openai.chat.completions.create({
       model: "gpt-4",
       messages: [{
         role: "system",
         content: "Extract all conflict events from the text. Return JSON array."
       }, {
         role: "user",
         content: text
       }]
     });
     
     return JSON.parse(response.choices[0].message.content);
   }
   ```

5. **Implement the re-ingestion loop**:
   ```javascript
   // Run every 30 minutes
   setInterval(async () => {
     await reingestionController.runReingestionCycle();
   }, 30 * 60 * 1000);
   ```

## 📊 What You'll See

### Before (V1):
- 1 article → 1 event
- "Russian forces attacked Kharkiv" → 1 event

### After (V2):
- 1 article → Multiple events
- Same article generates:
  - Event 1: Russian airstrike on Kharkiv
  - Event 2: 5 civilians killed
  - Event 3: Ukrainian response strikes
  - Event 4: Diplomatic talks in Istanbul
  
Plus:
- Named entities tracked: "Russian forces", "Kharkiv", "Istanbul"
- Attribution preserved: "according to local officials"
- Temporal precision: "yesterday" → "2024-01-14T00:00:00Z ±24h"
- Bias analysis: Source + content sentiment
- Auto-generated follow-up searches