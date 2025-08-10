/**
 * Named Entity Recognition Service
 * Extracts and normalizes entities from text
 */

import { OpenAI } from 'openai';
import { config } from '../core/config.js';

export class NamedEntityRecognition {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.apis.openai.apiKey
    });
    
    // Entity type definitions
    this.entityTypes = {
      PERSON: 'person',
      ORGANIZATION: 'organization', 
      LOCATION: 'location',
      WEAPON: 'weapon',
      GROUP: 'group',
      EVENT: 'event',
      DATE: 'date',
      CASUALTY: 'casualty'
    };
    
    // Known entity aliases for normalization
    this.entityAliases = {
      // Countries
      'USA': 'United States',
      'US': 'United States',
      'America': 'United States',
      'UK': 'United Kingdom',
      'Britain': 'United Kingdom',
      
      // Organizations
      'ISIS': 'Islamic State',
      'ISIL': 'Islamic State',
      'Daesh': 'Islamic State',
      'UN': 'United Nations',
      
      // Leaders
      'Zelensky': 'Volodymyr Zelenskyy',
      'Zelenskyy': 'Volodymyr Zelenskyy',
      'Putin': 'Vladimir Putin',
      'Biden': 'Joe Biden',
      
      // Military groups
      'IDF': 'Israel Defense Forces',
      'AFU': 'Armed Forces of Ukraine'
    };
  }
  
  /**
   * Extract entities from text using AI
   */
  async extractEntities(text, context = {}) {
    try {
      const prompt = this.buildExtractionPrompt(text, context);
      
      const response = await this.openai.chat.completions.create({
        model: config.apis.openai.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert named entity recognition system for conflict analysis. 
            Extract all relevant entities and return them in the specified JSON format.
            Focus on: people, organizations, locations, weapons, military units, and casualty figures.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      return this.processExtractedEntities(result.entities || []);
      
    } catch (error) {
      console.error('Entity extraction error:', error);
      return [];
    }
  }
  
  /**
   * Build extraction prompt
   */
  buildExtractionPrompt(text, context) {
    return `Extract all named entities from this conflict-related text.

Text: "${text}"

${context.location ? `Known location context: ${context.location}` : ''}
${context.date ? `Date context: ${context.date}` : ''}

Return a JSON object with an "entities" array. Each entity should have:
{
  "text": "the exact text from the source",
  "type": "PERSON|ORGANIZATION|LOCATION|WEAPON|GROUP|EVENT|DATE|CASUALTY",
  "subtype": "more specific classification if applicable",
  "normalized": "standardized form of the name",
  "confidence": 0.0-1.0,
  "context": "surrounding context that identifies this entity"
}

For casualties, extract:
{
  "text": "12 killed",
  "type": "CASUALTY",
  "subtype": "killed|wounded|missing",
  "value": 12,
  "confidence": 0.9
}

Be comprehensive but accurate. Include military units, government bodies, militant groups, weapons systems, and geographical locations.`;
  }
  
  /**
   * Process and normalize extracted entities
   */
  processExtractedEntities(entities) {
    return entities.map(entity => {
      // Normalize the entity name
      const normalized = this.normalizeEntityName(entity.text, entity.type);
      
      // Check for known aliases
      const canonical = this.entityAliases[normalized] || normalized;
      
      return {
        ...entity,
        normalized: canonical,
        aliases: this.findAliases(canonical),
        category: this.categorizeEntity(entity.type, entity.subtype)
      };
    });
  }
  
  /**
   * Normalize entity names
   */
  normalizeEntityName(name, type) {
    let normalized = name.trim();
    
    // Remove common prefixes/suffixes based on type
    if (type === 'PERSON') {
      normalized = normalized.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|President|Prime Minister)\s+/i, '');
    } else if (type === 'ORGANIZATION') {
      normalized = normalized.replace(/\s+(Forces|Army|Ministry|Department)$/i, match => match);
    }
    
    // Standardize capitalization
    normalized = normalized.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return normalized;
  }
  
  /**
   * Find known aliases for an entity
   */
  findAliases(canonicalName) {
    const aliases = [];
    
    for (const [alias, canonical] of Object.entries(this.entityAliases)) {
      if (canonical === canonicalName && alias !== canonicalName) {
        aliases.push(alias);
      }
    }
    
    return aliases;
  }
  
  /**
   * Categorize entities for better organization
   */
  categorizeEntity(type, subtype) {
    const categories = {
      PERSON: {
        'leader': 'Political Leaders',
        'military': 'Military Personnel',
        'civilian': 'Civilians',
        'journalist': 'Media Personnel'
      },
      ORGANIZATION: {
        'government': 'Government Bodies',
        'military': 'Military Organizations',
        'terrorist': 'Terrorist Organizations',
        'international': 'International Organizations',
        'media': 'Media Organizations'
      },
      LOCATION: {
        'country': 'Countries',
        'city': 'Cities',
        'region': 'Regions',
        'facility': 'Facilities'
      },
      WEAPON: {
        'missile': 'Missiles',
        'aircraft': 'Aircraft',
        'naval': 'Naval Assets',
        'small_arms': 'Small Arms',
        'explosive': 'Explosives'
      }
    };
    
    return categories[type]?.[subtype] || type;
  }
  
  /**
   * Link entities to database records
   */
  async linkEntities(entities, supabase) {
    const linkedEntities = [];
    
    for (const entity of entities) {
      // Check if entity exists in database
      const { data: existing } = await supabase
        .from('entities')
        .select('*')
        .eq('normalized_name', entity.normalized)
        .eq('type', entity.type.toLowerCase())
        .single();
      
      if (existing) {
        // Update occurrence count and last seen
        await supabase
          .from('entities')
          .update({
            occurrence_count: existing.occurrence_count + 1,
            last_seen: new Date(),
            aliases: Array.from(new Set([...existing.aliases, ...entity.aliases]))
          })
          .eq('id', existing.id);
        
        linkedEntities.push({ ...entity, entity_id: existing.id });
      } else {
        // Create new entity
        const { data: newEntity } = await supabase
          .from('entities')
          .insert({
            name: entity.text,
            normalized_name: entity.normalized,
            type: entity.type.toLowerCase(),
            subtype: entity.subtype,
            aliases: entity.aliases,
            metadata: {
              first_context: entity.context,
              category: entity.category
            }
          })
          .select()
          .single();
        
        linkedEntities.push({ ...entity, entity_id: newEntity?.id });
      }
    }
    
    return linkedEntities;
  }
  
  /**
   * Extract relationships between entities
   */
  extractEntityRelationships(entities, text) {
    const relationships = [];
    
    // Simple proximity-based relationship detection
    for (let i = 0; i < entities.length - 1; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Check if entities appear close together in text
        const index1 = text.indexOf(entity1.text);
        const index2 = text.indexOf(entity2.text);
        const distance = Math.abs(index2 - index1);
        
        if (distance < 100) { // Within ~100 characters
          relationships.push({
            entity1: entity1.normalized,
            entity2: entity2.normalized,
            type: this.inferRelationshipType(entity1, entity2, text),
            confidence: Math.max(0.3, 1 - (distance / 100))
          });
        }
      }
    }
    
    return relationships;
  }
  
  /**
   * Infer relationship type between entities
   */
  inferRelationshipType(entity1, entity2, text) {
    // Simple heuristics - could be enhanced with ML
    if (entity1.type === 'PERSON' && entity2.type === 'ORGANIZATION') {
      return 'affiliated_with';
    } else if (entity1.type === 'ORGANIZATION' && entity2.type === 'LOCATION') {
      return 'operates_in';
    } else if (entity1.type === 'PERSON' && entity2.type === 'LOCATION') {
      return 'located_in';
    } else if (text.includes('killed') || text.includes('attack')) {
      return 'conflict';
    }
    
    return 'related';
  }
}