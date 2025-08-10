/**
 * Text Processing Service
 * Handles NLP tasks for conflict event extraction
 */

import OpenAI from 'openai';
import { config } from '../core/config.js';
import crypto from 'crypto';
import { detectLanguage, translateArticle } from '../lib/argos-translate/translate.js';

export class TextProcessor {
  constructor() {
    this.openai = new OpenAI({ apiKey: config.apis.openai.apiKey });
    this.conflictKeywords = config.nlp.conflictKeywords;
    this.temporalExpressions = config.nlp.temporalExpressions;
    
    // Compile regex patterns for better performance
    this.patterns = {
      casualties: /(\d+)\s*(?:people|persons?|individuals?|civilians?|soldiers?|troops?)?\s*(?:were\s+)?(?:killed|dead|died|deceased)/gi,
      wounded: /(\d+)\s*(?:people|persons?|individuals?|civilians?|soldiers?)?\s*(?:were\s+)?(?:wounded|injured|hurt)/gi,
      weapons: /\b(?:missile|rocket|drone|artillery|mortar|bomb|IED|grenade|tank|aircraft|helicopter|fighter jet)\b/gi,
      militaryUnits: /\b(?:\d+(?:st|nd|rd|th))?\s*(?:brigade|battalion|regiment|division|corps|army|navy|air force|marines?)\b/gi,
      locations: /\b(?:in|at|near|outside|north of|south of|east of|west of)\s+([A-Z][a-zA-Z\s-]{2,30})/g,
      temporal: new RegExp(`\\b(${this.temporalExpressions.join('|')})\\b`, 'gi')
    };
  }

  /**
   * Clean and normalize text
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-.,!?;:()\[\]"']/g, '') // Remove special chars
      .trim();
  }

  /**
   * Detect language using enhanced detection
   */
  async detectLanguageEnhanced(text) {
    try {
      // Use the translation service's detection
      return await detectLanguage(text);
    } catch (error) {
      console.error('Language detection failed:', error);
      // Fallback to simple detection
      return this.detectLanguageSimple(text);
    }
  }

  /**
   * Simple language detection using patterns
   */
  detectLanguageSimple(text) {
    // Simple language detection based on character patterns
    const patterns = {
      en: /\b(the|and|of|to|in|is|was|for|that|with)\b/i,
      es: /\b(el|la|de|que|y|en|un|por|con|para)\b/i,
      fr: /\b(le|de|un|la|et|les|des|pour|dans|sur)\b/i,
      de: /\b(der|die|das|und|von|zu|mit|den|auf|für)\b/i,
      ar: /[\u0600-\u06FF]/,
      ru: /[\u0400-\u04FF]/,
      zh: /[\u4E00-\u9FFF]/,
      he: /[\u0590-\u05FF]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    return 'en'; // Default to English
  }

  /**
   * Process and translate article if needed
   */
  async processArticleLanguage(article) {
    const fullText = [
      article.title,
      article.snippet,
      article.content?.substring(0, 500)
    ].filter(Boolean).join(' ');

    // Detect language
    const language = await this.detectLanguageEnhanced(fullText);
    
    if (language !== 'en') {
      console.log(`Detected non-English article (${language}), translating...`);
      // Translate the article
      const translatedArticle = await translateArticle(article, language);
      return {
        ...translatedArticle,
        originalLanguage: language,
        translated: true
      };
    }

    return {
      ...article,
      originalLanguage: 'en',
      translated: false
    };
  }

  /**
   * Extract entities using pattern matching and AI
   */
  async extractEntities(text) {
    const entities = {
      persons: [],
      organizations: [],
      locations: [],
      dates: [],
      weapons: [],
      militaryUnits: [],
      casualties: { killed: null, wounded: null }
    };

    // Extract casualties
    const casualtyMatches = text.matchAll(this.patterns.casualties);
    for (const match of casualtyMatches) {
      const count = parseInt(match[1]);
      if (!isNaN(count) && count > 0) {
        entities.casualties.killed = (entities.casualties.killed || 0) + count;
      }
    }

    const woundedMatches = text.matchAll(this.patterns.wounded);
    for (const match of woundedMatches) {
      const count = parseInt(match[1]);
      if (!isNaN(count) && count > 0) {
        entities.casualties.wounded = (entities.casualties.wounded || 0) + count;
      }
    }

    // Extract weapons
    const weaponMatches = text.matchAll(this.patterns.weapons);
    for (const match of weaponMatches) {
      entities.weapons.push({
        text: match[0],
        type: 'weapon',
        confidence: 0.8
      });
    }

    // Extract military units
    const unitMatches = text.matchAll(this.patterns.militaryUnits);
    for (const match of unitMatches) {
      entities.militaryUnits.push({
        text: match[0],
        type: 'military_unit',
        confidence: 0.7
      });
    }

    // Extract locations using pattern
    const locationMatches = text.matchAll(this.patterns.locations);
    for (const match of locationMatches) {
      if (match[1]) {
        entities.locations.push({
          text: match[1].trim(),
          type: 'location',
          confidence: 0.6
        });
      }
    }

    // Use GPT for more sophisticated entity extraction
    try {
      const aiEntities = await this.extractEntitiesWithAI(text);
      
      // Merge AI results with pattern matching
      if (aiEntities.persons) entities.persons.push(...aiEntities.persons);
      if (aiEntities.organizations) entities.organizations.push(...aiEntities.organizations);
      if (aiEntities.locations) {
        // Deduplicate locations
        const existingLocations = new Set(entities.locations.map(l => l.text.toLowerCase()));
        for (const loc of aiEntities.locations) {
          if (!existingLocations.has(loc.text.toLowerCase())) {
            entities.locations.push(loc);
          }
        }
      }
      if (aiEntities.dates) entities.dates.push(...aiEntities.dates);
    } catch (error) {
      console.error('AI entity extraction failed:', error);
    }

    return entities;
  }

  /**
   * Extract entities using OpenAI
   */
  async extractEntitiesWithAI(text) {
    const prompt = `Extract named entities from this conflict-related text. Return valid JSON with:
    - persons: [{text: "name", role: "description"}]
    - organizations: [{text: "name", type: "military/government/terrorist/other"}]
    - locations: [{text: "name", type: "city/region/country"}]
    - dates: [{text: "date expression", normalized: "YYYY-MM-DD if possible"}]
    
    IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.
    
    Text: ${text.substring(0, 1500)}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.apis.openai.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a JSON entity extractor. Return only valid JSON with no markdown formatting or explanations.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" }  // Force JSON response
      });

      let content = response.choices[0].message.content;
      // Remove markdown code blocks if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to parse and validate JSON
      const parsed = JSON.parse(content);
      
      // Ensure all required fields exist
      const result = {
        persons: parsed.persons || [],
        organizations: parsed.organizations || [],
        locations: parsed.locations || [],
        dates: parsed.dates || []
      };
      
      // Validate array structure
      for (const key of Object.keys(result)) {
        if (!Array.isArray(result[key])) {
          result[key] = [];
        }
      }
      
      return result;
    } catch (error) {
      console.error('AI entity extraction error:', error);
      // Try to extract partial data if JSON parsing failed
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.error('Invalid JSON response from AI');
      }
      return { persons: [], organizations: [], locations: [], dates: [] };
    }
  }

  /**
   * Extract temporal information
   */
  extractTemporalInfo(text, articleDate = new Date()) {
    const temporalInfo = {
      expressions: [],
      estimatedTime: null,
      confidence: 0.0,
      timeIndicators: []
    };

    // Find temporal expressions
    const temporalMatches = text.matchAll(this.patterns.temporal);
    for (const match of temporalMatches) {
      temporalInfo.expressions.push({
        text: match[0],
        position: match.index,
        type: 'relative'
      });
      temporalInfo.timeIndicators.push(match[0].toLowerCase());
    }

    // Find absolute dates (basic patterns)
    const datePatterns = [
      /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
      /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        temporalInfo.expressions.push({
          text: match[0],
          position: match.index,
          type: 'absolute'
        });
      }
    }

    // Estimate event time
    const { time, confidence } = this.estimateEventTime(
      temporalInfo.timeIndicators,
      temporalInfo.expressions,
      articleDate
    );

    temporalInfo.estimatedTime = time;
    temporalInfo.confidence = confidence;

    return temporalInfo;
  }

  /**
   * Estimate event time from temporal expressions
   */
  estimateEventTime(indicators, expressions, baseDate) {
    const now = new Date(baseDate);
    
    // Check for specific indicators
    if (indicators.includes('breaking') || indicators.includes('now')) {
      return { time: now, confidence: 0.9 };
    }
    
    if (indicators.includes('today')) {
      const today = new Date(now);
      today.setHours(12, 0, 0, 0);
      return { time: today, confidence: 0.8 };
    }
    
    if (indicators.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);
      return { time: yesterday, confidence: 0.8 };
    }
    
    if (indicators.includes('this morning')) {
      const morning = new Date(now);
      morning.setHours(8, 0, 0, 0);
      return { time: morning, confidence: 0.7 };
    }
    
    if (indicators.includes('last night')) {
      const lastNight = new Date(now);
      lastNight.setDate(lastNight.getDate() - 1);
      lastNight.setHours(22, 0, 0, 0);
      return { time: lastNight, confidence: 0.7 };
    }
    
    // Try to parse absolute dates
    for (const expr of expressions) {
      if (expr.type === 'absolute') {
        try {
          const parsed = new Date(expr.text);
          if (!isNaN(parsed.getTime())) {
            return { time: parsed, confidence: 0.9 };
          }
        } catch (e) {
          // Continue to next expression
        }
      }
    }
    
    // Default to article date with low confidence
    return { time: baseDate, confidence: 0.3 };
  }

  /**
   * Classify conflict relevance
   */
  classifyConflictRelevance(text) {
    const textLower = text.toLowerCase();
    
    // Count keyword matches
    const keywordMatches = [];
    for (const keyword of this.conflictKeywords) {
      if (textLower.includes(keyword)) {
        keywordMatches.push(keyword);
      }
    }
    
    // Calculate relevance score
    const relevanceScore = Math.min(1.0, keywordMatches.length / 5.0);
    
    // Classify conflict types
    const conflictTypes = [];
    
    if (/\b(attack|bombing|airstrike|missile|strike|assault)\b/.test(textLower)) {
      conflictTypes.push('military_action');
    }
    if (/\b(killed|casualties|dead|wounded|injured|died)\b/.test(textLower)) {
      conflictTypes.push('casualties');
    }
    if (/\b(ceasefire|peace|negotiation|agreement|talks)\b/.test(textLower)) {
      conflictTypes.push('diplomatic');
    }
    if (/\b(refugee|displaced|evacuation|humanitarian|aid)\b/.test(textLower)) {
      conflictTypes.push('humanitarian');
    }
    if (/\b(destroyed|damaged|hit|targeted|bombed)\b/.test(textLower)) {
      conflictTypes.push('infrastructure');
    }
    
    return {
      relevanceScore,
      isConflictRelated: relevanceScore > config.processing.minRelevanceScore,
      matchedKeywords: keywordMatches,
      conflictTypes,
      confidence: Math.min(1.0, relevanceScore + 0.2)
    };
  }

  /**
   * Extract factual claims
   */
  extractFactualClaims(text) {
    const claims = [];
    
    // Split into sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    for (const sentence of sentences) {
      const sentenceTrimmed = sentence.trim();
      
      // Check if sentence contains factual claim patterns
      if (this.isFactualClaim(sentenceTrimmed)) {
        const claimInfo = this.parseClaimStructure(sentenceTrimmed);
        
        claims.push({
          text: sentenceTrimmed,
          subject: claimInfo.subject,
          predicate: claimInfo.predicate,
          object: claimInfo.object,
          confidence: claimInfo.confidence,
          type: this.classifyClaimType(sentenceTrimmed)
        });
      }
    }
    
    return claims;
  }

  /**
   * Check if sentence is a factual claim
   */
  isFactualClaim(sentence) {
    const claimPatterns = [
      /\b\d+\s+(?:killed|wounded|injured|dead|casualties)\b/i,
      /\b(?:attacked|bombed|struck|destroyed|damaged)\b/i,
      /\b(?:reported|confirmed|announced|stated|said)\b.*\b(?:killed|attack|strike)\b/i,
      /\b(?:according to|sources say|officials said)\b/i
    ];
    
    return claimPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Parse claim structure
   */
  parseClaimStructure(sentence) {
    // Simple extraction using regex patterns
    const structure = {
      subject: null,
      predicate: null,
      object: null,
      confidence: 0.5
    };
    
    // Look for subject-verb-object patterns
    const patterns = {
      actor: /^([A-Z][a-zA-Z\s]+)\s+(?:has|have|had)?\s*(?:attacked|bombed|struck|killed)/i,
      casualty: /(\d+)\s+(?:people|persons?|civilians?|soldiers?)\s+(?:were\s+)?(?:killed|wounded)/i,
      location: /(?:in|at|near)\s+([A-Z][a-zA-Z\s-]+)/i
    };
    
    const actorMatch = sentence.match(patterns.actor);
    if (actorMatch) {
      structure.subject = actorMatch[1].trim();
      structure.confidence = 0.7;
    }
    
    const casualtyMatch = sentence.match(patterns.casualty);
    if (casualtyMatch) {
      structure.object = casualtyMatch[0];
      structure.predicate = 'caused casualties';
      structure.confidence = 0.8;
    }
    
    const locationMatch = sentence.match(patterns.location);
    if (locationMatch && !structure.object) {
      structure.object = locationMatch[1].trim();
    }
    
    return structure;
  }

  /**
   * Classify claim type
   */
  classifyClaimType(claimText) {
    const textLower = claimText.toLowerCase();
    
    if (/\b(killed|dead|casualties|wounded)\b/.test(textLower)) {
      return 'casualty';
    }
    if (/\b(attack|bombing|strike|assault)\b/.test(textLower)) {
      return 'military_action';
    }
    if (/\b(destroyed|damaged|hit)\b/.test(textLower)) {
      return 'damage';
    }
    if (/\b(said|reported|announced|confirmed)\b/.test(textLower)) {
      return 'statement';
    }
    
    return 'general';
  }

  /**
   * Calculate text similarity
   */
  calculateSimilarity(text1, text2) {
    // Normalize texts
    const norm1 = this.normalizeForComparison(text1);
    const norm2 = this.normalizeForComparison(text2);
    
    // Use Jaccard similarity
    const words1 = new Set(norm1.split(/\s+/));
    const words2 = new Set(norm2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Normalize text for comparison
   */
  normalizeForComparison(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate content hash for deduplication
   */
  generateContentHash(text) {
    const normalized = this.normalizeForComparison(text);
    return crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Analyze article with GPT-4o
   */
  async analyzeWithAI(text, promptTemplate) {
    try {
      const response = await this.openai.chat.completions.create({
        model: config.apis.openai.model,
        messages: [{
          role: 'user',
          content: promptTemplate.replace('{text}', text.substring(0, 2000))
        }],
        temperature: config.apis.openai.temperature,
        max_tokens: config.apis.openai.maxTokens
      });

      let content = response.choices[0].message.content;
      
      // Try to parse as JSON
      try {
        // Remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        return JSON.parse(content);
      } catch (e) {
        // If not valid JSON, return raw content
        return { raw: content, error: 'Invalid JSON response' };
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      throw error;
    }
  }
}

export default TextProcessor;