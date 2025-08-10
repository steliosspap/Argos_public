/**
 * Event Extraction Service
 * Extracts structured conflict events from articles
 */

import { ConflictEvent } from '../models/Event.js';
import { TextProcessor } from './TextProcessor.js';
import { EnhancedGeospatialService } from './EnhancedGeospatialService.js';
import { embedEvent } from '../lib/sentence-transformers/embedText.js';
import { MediaBiasAnalyzer } from './MediaBiasAnalyzer.js';
import { EntityLinker } from './EntityLinker.js';
import { config } from '../core/config.js';

export class EventExtractor {
  constructor() {
    this.textProcessor = new TextProcessor();
    this.geoService = new EnhancedGeospatialService();
    this.biasAnalyzer = new MediaBiasAnalyzer();
    this.entityLinker = new EntityLinker();
  }

  /**
   * Analyze article and extract conflict events
   */
  async analyzeArticle(article) {
    const result = {
      isConflictRelated: false,
      relevanceScore: 0,
      events: [],
      entities: {},
      claims: []
    };

    try {
      // Process language and translate if needed
      const processedArticle = await this.textProcessor.processArticleLanguage(article);
      
      // Combine available text
      const fullText = [
        processedArticle.title,
        processedArticle.snippet,
        processedArticle.content
      ].filter(Boolean).join(' ');

      if (!fullText) {
        return result;
      }

      // Check conflict relevance
      const relevance = this.textProcessor.classifyConflictRelevance(fullText);
      result.relevanceScore = relevance.relevanceScore;
      result.isConflictRelated = relevance.isConflictRelated;

      if (!relevance.isConflictRelated) {
        return result;
      }

      // Extract entities
      const entities = await this.textProcessor.extractEntities(fullText);
      result.entities = entities;
      
      // Link entities to Wikidata QIDs
      const linkedEntities = await this.linkExtractedEntities(entities, fullText);
      result.linkedEntities = linkedEntities;

      // Extract temporal information
      const temporalInfo = this.textProcessor.extractTemporalInfo(
        fullText,
        processedArticle.publishedDate
      );

      // Extract factual claims
      const claims = this.textProcessor.extractFactualClaims(fullText);
      result.claims = claims;

      // Use AI to extract structured event data
      const aiAnalysis = await this.analyzeWithAI(processedArticle, entities, temporalInfo);

      if (aiAnalysis && aiAnalysis.is_conflict !== false) {
        // Create events from AI analysis
        const events = await this.createEventsFromAnalysis(
          aiAnalysis,
          processedArticle,
          entities,
          temporalInfo,
          claims,
          linkedEntities
        );
        
        result.events = events;
      }

      // Fallback: Extract events using pattern matching
      if (result.events.length === 0 && entities.casualties.killed) {
        const patternEvent = await this.createEventFromPatterns(
          processedArticle,
          entities,
          temporalInfo,
          relevance,
          linkedEntities
        );
        
        if (patternEvent) {
          result.events.push(patternEvent);
        }
      }

      // Add translation metadata to all events
      result.events.forEach(event => {
        if (processedArticle.translated) {
          event.translated = true;
          event.originalLanguage = processedArticle.originalLanguage;
        }
      });

    } catch (error) {
      console.error('Event extraction error:', error);
      // Continue with partial results
    }

    return result;
  }

  /**
   * Analyze article with AI
   */
  async analyzeWithAI(article, entities, temporalInfo) {
    const prompt = `Analyze this news article for conflict/military relevance. Extract structured data:

Title: ${article.title}
Content: ${article.snippet || article.content?.substring(0, 1000)}

${config.apis.openai.model === 'gpt-4o' ? `
1. Is this about military/armed conflict? (yes/no)
2. If yes, provide:
   - enhanced_headline: (Create a clear, concise headline that explicitly describes the military action/conflict. Focus on: WHO did WHAT to WHOM, WHERE, and WHEN. Examples: "Russian Forces Strike Kyiv with 20 Missiles, 5 Killed", "Hamas Launches Rocket Attack on Tel Aviv, IDF Responds", "US Drone Strike Kills Al-Qaeda Leader in Syria")
   - conflict_type: (armed_conflict, terrorism, military_operation, civil_unrest, military_exercise, or other)
   - primary_actors: [list of main parties involved]
   - location: {country, city/region, coordinates if mentioned}
   - severity: (low, medium, high, critical)
   - escalation_score: (1-10, where 10 is major war/massive casualties)
   - casualties: {killed: number or null, wounded: number or null}
   - key_events: [brief list of what happened]
   - is_ongoing: (true/false)
   - verification_confidence: (0-1, how reliable is this information)

IMPORTANT: The enhanced_headline should be informative and specific about the military/conflict action, not vague or clickbait. Include numbers, specific weapons/actions, and outcomes when available.` : ''}

Return ONLY valid JSON. If not military/conflict related, return: {"is_conflict": false}`;

    try {
      const analysis = await this.textProcessor.analyzeWithAI(
        article.content || article.snippet || article.title,
        prompt
      );

      return analysis;
    } catch (error) {
      console.error('AI analysis failed:', error);
      return null;
    }
  }

  /**
   * Create events from AI analysis
   */
  async createEventsFromAnalysis(analysis, article, entities, temporalInfo, claims, linkedEntities = []) {
    const events = [];

    try {
      // Skip if not conflict-related
      if (analysis.is_conflict === false) {
        return events;
      }

      // Create base event
      const event = new ConflictEvent({
        articleId: article.id || null,
        title: article.title,
        summary: article.snippet,
        enhancedHeadline: analysis.enhanced_headline || article.title,
        
        // Temporal data
        timestamp: temporalInfo.estimatedTime,
        temporalExpression: temporalInfo.expressions[0]?.text,
        timestampConfidence: temporalInfo.confidence,
        
        // Event classification
        eventType: this.mapConflictType(analysis.conflict_type),
        conflictType: analysis.conflict_type,
        severity: analysis.severity || 'medium',
        escalationScore: analysis.escalation_score || 5,
        
        // Actors
        primaryActors: analysis.primary_actors || [],
        participants: [
          ...(analysis.primary_actors || []),
          ...(entities.organizations?.map(o => o.text) || [])
        ],
        
        // Impact
        casualties: {
          killed: analysis.casualties?.killed || entities.casualties.killed,
          wounded: analysis.casualties?.wounded || entities.casualties.wounded,
          total: null
        },
        
        // Source info
        source: article.source,
        sourceType: 'news',
        attributionSource: article.source,
        
        // Metadata
        tags: this.generateTags(analysis, entities),
        extractionConfidence: analysis.verification_confidence || 0.7,
        reliability: this.calculateReliability(article, analysis)
      });

      // Set location data with enhanced resolution
      if (analysis.location) {
        event.locationName = analysis.location.city || analysis.location.region || analysis.location.country;
        event.country = analysis.location.country;
        event.region = analysis.location.region;
        
        // Build full location context
        const locationContext = [
          analysis.location.specific_location,
          analysis.location.city,
          analysis.location.region,
          analysis.location.country
        ].filter(Boolean).join(', ');
        
        // Resolve coordinates with full context and event details
        const coords = await this.geoService.resolveLocation(
          locationContext || event.locationName,
          article.content || article.snippet,
          event.timestamp
        );
        
        if (coords) {
          event.location = coords; // PostGIS format
          console.log(`Resolved location for "${event.locationName}" to ${coords}`);
        } else {
          console.warn(`Failed to resolve coordinates for: ${event.locationName}`);
        }
      } else if (entities.locations?.length > 0) {
        // Extract all location mentions for better resolution
        const locationMentions = entities.locations.map(l => l.text).join(', ');
        event.locationName = entities.locations[0].text;
        
        // Try enhanced resolution with all location context
        const coords = await this.geoService.resolveLocation(
          locationMentions,
          article.content || article.snippet,
          event.timestamp
        );
        
        if (coords) {
          event.location = coords;
          console.log(`Resolved location for "${event.locationName}" to ${coords}`);
        } else {
          console.warn(`Failed to resolve coordinates for: ${event.locationName}`);
        }
      }

      // Calculate total casualties
      if (event.casualties.killed || event.casualties.wounded) {
        event.casualties.total = (event.casualties.killed || 0) + (event.casualties.wounded || 0);
      }

      // Add key events as part of summary
      if (analysis.key_events && analysis.key_events.length > 0) {
        event.summary = `${event.summary || ''} Key events: ${analysis.key_events.join('; ')}`;
      }

      // Generate embedding for the event
      try {
        event.embedding = await embedEvent(event);
        console.log('Generated embedding for event:', event.enhancedHeadline?.substring(0, 50));
      } catch (embedError) {
        console.error('Failed to generate embedding:', embedError);
        // Continue without embedding
      }

      // Phase 2: Analyze bias
      try {
        const biasAnalysis = await this.analyzeBias(article);
        event.bias = biasAnalysis;
        console.log(`Analyzed bias for event: ${biasAnalysis.politicalAlignment} (${biasAnalysis.confidence.toFixed(2)} confidence)`);
      } catch (biasError) {
        console.error('Failed to analyze bias:', biasError);
        // Continue without bias analysis
      }

      // Phase 2: Add linked entities
      if (linkedEntities && linkedEntities.length > 0) {
        event.entityLinks = linkedEntities;
        console.log(`Linked ${linkedEntities.length} entities for event`);
      }

      events.push(event);

      // Create separate events for distinct incidents mentioned
      if (analysis.multiple_incidents) {
        // Handle multiple incidents in same article
        for (const incident of analysis.multiple_incidents) {
          const subEvent = new ConflictEvent({
            ...event,
            id: crypto.randomUUID(),
            title: incident.description,
            enhancedHeadline: incident.headline,
            locationName: incident.location,
            casualties: incident.casualties || {}
          });
          
          // Generate embedding for sub-event
          try {
            subEvent.embedding = await embedEvent(subEvent);
          } catch (embedError) {
            console.error('Failed to generate embedding for sub-event:', embedError);
          }
          
          events.push(subEvent);
        }
      }

    } catch (error) {
      console.error('Error creating events from analysis:', error);
    }

    return events;
  }

  /**
   * Create event from pattern matching (fallback)
   */
  async createEventFromPatterns(article, entities, temporalInfo, relevance, linkedEntities = []) {
    // Only create event if we have significant indicators
    if (!entities.casualties.killed && 
        !entities.weapons.length && 
        relevance.conflictTypes.length === 0) {
      return null;
    }

    const event = new ConflictEvent({
      title: article.title,
      summary: article.snippet,
      enhancedHeadline: this.generateHeadline(article, entities),
      
      timestamp: temporalInfo.estimatedTime,
      timestampConfidence: temporalInfo.confidence * 0.7, // Lower confidence for pattern matching
      
      eventType: relevance.conflictTypes[0] || 'unknown',
      severity: this.estimateSeverity(entities),
      escalationScore: this.calculateEscalationScore(entities, relevance),
      
      casualties: entities.casualties,
      
      source: article.source,
      sourceType: 'news',
      
      extractionConfidence: 0.5, // Lower confidence for pattern-based extraction
      reliability: 0.6
    });

    // Set location with enhanced resolution
    if (entities.locations?.length > 0) {
      // Use all location mentions for better context
      const locationMentions = entities.locations.map(l => l.text).join(', ');
      event.locationName = entities.locations[0].text;
      
      // Try enhanced resolution with full context
      const coords = await this.geoService.resolveLocation(
        locationMentions,
        article.content || article.snippet,
        event.timestamp
      );
      
      if (coords) {
        event.location = coords;
        console.log(`Pattern extraction: Resolved location for "${event.locationName}" to ${coords}`);
      } else {
        // Try fallback with just the primary location
        const fallbackCoords = await this.geoService.resolveLocation(event.locationName);
        if (fallbackCoords) {
          event.location = fallbackCoords;
          console.log(`Pattern extraction: Fallback resolved "${event.locationName}" to ${fallbackCoords}`);
        } else {
          console.warn(`Pattern extraction: Failed to resolve coordinates for: ${event.locationName}`);
        }
      }
    }

    // Set actors from organizations
    if (entities.organizations?.length > 0) {
      event.primaryActors = entities.organizations.slice(0, 2).map(o => o.text);
      event.participants = entities.organizations.map(o => o.text);
    }

    // Generate embedding for pattern-based event
    try {
      event.embedding = await embedEvent(event);
      console.log('Generated embedding for pattern-based event');
    } catch (embedError) {
      console.error('Failed to generate embedding for pattern-based event:', embedError);
    }

    // Add linked entities
    if (linkedEntities && linkedEntities.length > 0) {
      event.entityLinks = linkedEntities;
    }

    return event;
  }

  /**
   * Map conflict type to event type
   */
  mapConflictType(conflictType) {
    const mapping = {
      'armed_conflict': 'military_action',
      'terrorism': 'terrorist_attack',
      'military_operation': 'military_action',
      'civil_unrest': 'civil_unrest',
      'military_exercise': 'military_exercise',
      'other': 'unknown'
    };

    return mapping[conflictType] || conflictType || 'unknown';
  }

  /**
   * Generate tags for event
   */
  generateTags(analysis, entities) {
    const tags = [];

    // Add conflict type tags
    if (analysis.conflict_type) {
      tags.push(analysis.conflict_type);
    }

    // Add severity tag
    if (analysis.severity) {
      tags.push(`severity:${analysis.severity}`);
    }

    // Add weapon tags
    if (entities.weapons?.length > 0) {
      entities.weapons.slice(0, 3).forEach(w => {
        tags.push(`weapon:${w.text.toLowerCase()}`);
      });
    }

    // Add actor type tags
    if (analysis.primary_actors?.length > 0) {
      if (analysis.primary_actors.some(a => /government|military|army/i.test(a))) {
        tags.push('state-actor');
      }
      if (analysis.primary_actors.some(a => /rebel|militant|terrorist/i.test(a))) {
        tags.push('non-state-actor');
      }
    }

    // Add ongoing tag
    if (analysis.is_ongoing) {
      tags.push('ongoing');
    }

    return tags;
  }

  /**
   * Calculate reliability score
   */
  calculateReliability(article, analysis) {
    let score = 0.5; // Base score

    // Source reliability (would lookup from database)
    if (article.source) {
      // Known reliable sources get bonus
      const reliableSources = ['Reuters', 'AP', 'BBC', 'UN News'];
      if (reliableSources.some(s => article.source.includes(s))) {
        score += 0.2;
      }
    }

    // AI confidence
    if (analysis.verification_confidence) {
      score = (score + analysis.verification_confidence) / 2;
    }

    // Multiple sources mentioned
    if (article.content && /according to|officials said|sources say/i.test(article.content)) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Generate headline from patterns
   */
  generateHeadline(article, entities) {
    const parts = [];

    // Add location
    if (entities.locations?.length > 0) {
      parts.push(entities.locations[0].text);
    }

    // Add action
    if (entities.casualties.killed) {
      parts.push(`${entities.casualties.killed} Killed`);
    }
    if (entities.weapons?.length > 0) {
      parts.push(`in ${entities.weapons[0].text} Attack`);
    }

    // Add actors
    if (entities.organizations?.length > 0) {
      parts.push(`by ${entities.organizations[0].text}`);
    }

    return parts.length > 0 ? parts.join(' ') : article.title;
  }

  /**
   * Estimate severity based on entities
   */
  estimateSeverity(entities) {
    const casualties = (entities.casualties.killed || 0) + (entities.casualties.wounded || 0);

    if (casualties > 50) return 'critical';
    if (casualties > 20) return 'high';
    if (casualties > 5) return 'medium';
    return 'low';
  }

  /**
   * Calculate escalation score
   */
  calculateEscalationScore(entities, relevance) {
    let score = 5; // Base score

    // Casualties
    const casualties = (entities.casualties.killed || 0) + (entities.casualties.wounded || 0);
    if (casualties > 100) score = 10;
    else if (casualties > 50) score = 9;
    else if (casualties > 20) score = 8;
    else if (casualties > 10) score = 7;
    else if (casualties > 0) score = 6;

    // Weapons used
    if (entities.weapons?.some(w => /nuclear|chemical|biological/i.test(w.text))) {
      score = 10;
    } else if (entities.weapons?.some(w => /missile|rocket|bomb/i.test(w.text))) {
      score = Math.max(score, 7);
    }

    // Multiple conflict types
    if (relevance.conflictTypes.length > 2) {
      score = Math.min(10, score + 1);
    }

    return score;
  }

  /**
   * Analyze bias for an article
   */
  async analyzeBias(article) {
    try {
      const fullText = [
        article.title,
        article.snippet,
        article.content?.substring(0, 2000) // Limit content for bias analysis
      ].filter(Boolean).join(' ');
      
      const biasAnalysis = await this.biasAnalyzer.analyzeBias(fullText, article.source);
      
      return biasAnalysis;
    } catch (error) {
      console.error('Bias analysis error:', error);
      return {
        sourceBias: 'unknown',
        contentBiasScore: 0,
        politicalAlignment: 'unknown',
        confidence: 0
      };
    }
  }

  /**
   * Link extracted entities to Wikidata QIDs
   */
  async linkExtractedEntities(entities, context) {
    try {
      const namedEntities = [];
      
      // Collect all named entities from different categories
      if (entities.persons) {
        entities.persons.forEach(person => {
          namedEntities.push({
            text: person.text || person,
            type: 'PERSON',
            confidence: person.confidence || 0.8
          });
        });
      }
      
      if (entities.organizations) {
        entities.organizations.forEach(org => {
          namedEntities.push({
            text: org.text || org,
            type: 'ORG',
            confidence: org.confidence || 0.8
          });
        });
      }
      
      if (entities.locations) {
        entities.locations.forEach(loc => {
          namedEntities.push({
            text: loc.text || loc,
            type: 'LOC',
            confidence: loc.confidence || 0.8
          });
        });
      }
      
      // Skip if no entities to link
      if (namedEntities.length === 0) {
        return [];
      }
      
      // Link entities with context
      const linkedEntities = await this.entityLinker.linkEntitiesWithContext(context, namedEntities);
      
      console.log(`Linked ${linkedEntities.length} of ${namedEntities.length} entities`);
      
      return linkedEntities;
    } catch (error) {
      console.error('Entity linking error:', error);
      return [];
    }
  }
}

export default EventExtractor;