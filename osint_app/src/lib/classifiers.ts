/**
 * Event Classification System
 * Structured classification functions for conflicts, news, and arms events
 */

import { ConflictEvent, ArmsEvent, IntelligenceEnrichment } from './intelligence';
import { CONFLICT_PROMPTS, NEWS_PROMPTS, ARMS_PROMPTS, buildPrompt, parseEscalationResponse } from './prompts';

// Classification result interfaces
export interface ConflictClassification {
  eventId: string;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  conflictType: 'civil_war' | 'territorial_dispute' | 'insurgency' | 'occupation' | 'other';
  escalationScore: number;
  severity: number;
  primaryActors: string[];
  weaponSystems: string[];
  geographicScope: 'local' | 'regional' | 'international';
  durationEstimate: 'short_term' | 'medium_term' | 'long_term';
  internationalResponse: 'none' | 'diplomatic' | 'sanctions' | 'intervention';
  confidence: number;
  reasoning: string;
  lastUpdated: string;
}

export interface NewsClassification {
  newsId: string;
  relevanceScore: number;
  intelligenceValue: 'low' | 'medium' | 'high' | 'critical';
  eventType: 'military' | 'political' | 'economic' | 'humanitarian' | 'diplomatic';
  urgencyLevel: 'routine' | 'priority' | 'urgent' | 'flash';
  verificationStatus: 'unverified' | 'partially_verified' | 'verified' | 'disputed';
  keyEntities: string[];
  geopoliticalImpact: string;
  followUpRequired: boolean;
  relatedEvents: string[];
  confidence: number;
  lastUpdated: string;
}

export interface ArmsClassification {
  dealId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  strategicSignificance: 'minimal' | 'moderate' | 'significant' | 'critical';
  technologyLevel: 'basic' | 'advanced' | 'cutting_edge' | 'classified';
  proliferationRisk: number;
  regionalImpact: 'stabilizing' | 'neutral' | 'destabilizing' | 'crisis_inducing';
  allianceImplications: string[];
  marketIndicators: string[];
  monitoringPriority: 'low' | 'medium' | 'high' | 'critical';
  controlMeasures: string[];
  confidence: number;
  lastUpdated: string;
}

// Rule-based classification system (fallback when LLM unavailable)
export class RuleBasedClassifier {
  
  static isValidConflictEvent(event: ConflictEvent): boolean {
    const fullText = `${event.headline} ${event.description || ''} ${event.tags.join(' ')}`.toLowerCase();
    
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
    if (isExcluded) return false;
    
    // Check requirements
    const hasRequired = requirePatterns.some(pattern => pattern.test(fullText));
    return hasRequired;
  }
  
  static classifyConflict(event: ConflictEvent): ConflictClassification {
    const fullText = `${event.headline} ${event.description || ''} ${event.tags.join(' ')}`.toLowerCase();
    
    // First, check for false positive indicators
    const falsePositiveIndicators = [
      'video game', 'gaming', 'esports', 'movie', 'film', 'tv show', 'television',
      'book', 'novel', 'fiction', 'simulation', 'training exercise', 'drill',
      'memorial', 'anniversary', 'historical', 'museum', 'documentary',
      'protest', 'demonstration', 'peaceful', 'rally', 'march',
      'politician', 'senator', 'congressman', 'parliament', 'debate', 'election',
      'speech', 'statement', 'comment', 'opinion', 'interview',
      'sports', 'football', 'soccer', 'basketball', 'olympics',
      'accident', 'crash', 'natural disaster', 'earthquake', 'hurricane',
      'animal', 'wildlife', 'bee', 'wasp', 'dog', 'bear', 'shark'
    ];
    
    const contextIndicators = [
      'said', 'says', 'stated', 'announced', 'declared', 'warned',
      'discussed', 'mentioned', 'referred', 'talked about', 'commented'
    ];
    
    // Check if this is likely a false positive
    const hasFalsePositive = falsePositiveIndicators.some(indicator => fullText.includes(indicator));
    const isIndirectReference = contextIndicators.filter(indicator => fullText.includes(indicator)).length >= 2;
    
    // Determine threat level based on keywords
    let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let escalationScore = 1;
    
    // If it's likely a false positive, cap the threat level
    if (hasFalsePositive || isIndirectReference) {
      escalationScore = Math.min(escalationScore, 2);
    }
    
    // Critical threat indicators
    const criticalIndicators = ['nuclear', 'chemical weapons', 'genocide', 'mass killing', 'war crimes'];
    const criticalMatches = criticalIndicators.filter(indicator => fullText.includes(indicator));
    if (criticalMatches.length > 0 && !hasFalsePositive) {
      threatLevel = 'CRITICAL';
      escalationScore = hasFalsePositive || isIndirectReference ? 3 : 9;
    }
    
    // High threat indicators
    const highIndicators = ['invasion', 'airstrike', 'bombing', 'missile strike', 'military offensive'];
    const highMatches = highIndicators.filter(indicator => fullText.includes(indicator));
    if (highMatches.length > 0 && threatLevel === 'LOW' && !hasFalsePositive) {
      threatLevel = 'HIGH';
      escalationScore = hasFalsePositive || isIndirectReference ? 2 : 7;
    }
    
    // Medium threat indicators
    const mediumIndicators = ['armed clash', 'firefight', 'military operation', 'border incident'];
    const mediumMatches = mediumIndicators.filter(indicator => fullText.includes(indicator));
    if (mediumMatches.length > 0 && threatLevel === 'LOW' && !hasFalsePositive) {
      threatLevel = 'MEDIUM';
      escalationScore = hasFalsePositive || isIndirectReference ? 2 : 4;
    }
    
    // Additional validation: require actual military action words
    const actionIndicators = ['killed', 'injured', 'wounded', 'attacked', 'struck', 'fired', 'launched', 'detonated'];
    const hasActionWords = actionIndicators.some(word => fullText.includes(word));
    
    // If no action words and has false positive indicators, downgrade
    if (!hasActionWords && (hasFalsePositive || isIndirectReference)) {
      threatLevel = 'LOW';
      escalationScore = Math.min(escalationScore, 2);
    }
    
    // Classify conflict type
    let conflictType: ConflictClassification['conflictType'] = 'other';
    if (fullText.includes('civil war') || fullText.includes('civil conflict')) {
      conflictType = 'civil_war';
    } else if (fullText.includes('border') || fullText.includes('territorial')) {
      conflictType = 'territorial_dispute';
    } else if (fullText.includes('insurgent') || fullText.includes('rebel')) {
      conflictType = 'insurgency';
    } else if (fullText.includes('occupation') || fullText.includes('invasion')) {
      conflictType = 'occupation';
    }
    
    // Extract actors
    const primaryActors = this.extractActorsFromText(fullText);
    
    // Extract weapon systems
    const weaponSystems = this.extractWeaponsFromText(fullText);
    
    // Determine geographic scope
    let geographicScope: ConflictClassification['geographicScope'] = 'local';
    if (fullText.includes('international') || fullText.includes('coalition') || fullText.includes('nato')) {
      geographicScope = 'international';
    } else if (fullText.includes('regional') || fullText.includes('border')) {
      geographicScope = 'regional';
    }
    
    // Estimate duration
    let durationEstimate: ConflictClassification['durationEstimate'] = 'medium_term';
    if (fullText.includes('ceasefire') || fullText.includes('peace')) {
      durationEstimate = 'short_term';
    } else if (fullText.includes('war') || fullText.includes('occupation')) {
      durationEstimate = 'long_term';
    }
    
    // Predict international response
    let internationalResponse: ConflictClassification['internationalResponse'] = 'none';
    if (escalationScore >= 8) {
      internationalResponse = 'intervention';
    } else if (escalationScore >= 6) {
      internationalResponse = 'sanctions';
    } else if (escalationScore >= 3) {
      internationalResponse = 'diplomatic';
    }
    
    return {
      eventId: event.id,
      threatLevel,
      conflictType,
      escalationScore,
      severity: escalationScore,
      primaryActors,
      weaponSystems,
      geographicScope,
      durationEstimate,
      internationalResponse,
      confidence: 0.75, // Rule-based confidence
      reasoning: `Rule-based classification: ${criticalMatches.length + highMatches.length + mediumMatches.length} threat indicators detected`,
      lastUpdated: new Date().toISOString()
    };
  }

  static classifyNews(headline: string, content: string, region?: string, tags: string[] = []): NewsClassification {
    const fullText = `${headline} ${content} ${tags.join(' ')}`.toLowerCase();
    
    // Calculate relevance score
    const relevanceKeywords = [
      'military', 'defense', 'conflict', 'war', 'security', 'intelligence',
      'weapons', 'arms', 'missile', 'nuclear', 'cyber', 'terrorism'
    ];
    const relevanceMatches = relevanceKeywords.filter(keyword => fullText.includes(keyword));
    const relevanceScore = Math.min(relevanceMatches.length * 0.15, 1.0);
    
    // Determine intelligence value
    let intelligenceValue: NewsClassification['intelligenceValue'] = 'low';
    if (relevanceScore >= 0.6) intelligenceValue = 'critical';
    else if (relevanceScore >= 0.4) intelligenceValue = 'high';
    else if (relevanceScore >= 0.2) intelligenceValue = 'medium';
    
    // Classify event type
    let eventType: NewsClassification['eventType'] = 'military';
    if (fullText.includes('diplomatic') || fullText.includes('negotiation')) {
      eventType = 'diplomatic';
    } else if (fullText.includes('economic') || fullText.includes('trade')) {
      eventType = 'economic';
    } else if (fullText.includes('humanitarian') || fullText.includes('refugee')) {
      eventType = 'humanitarian';
    } else if (fullText.includes('political') || fullText.includes('government')) {
      eventType = 'political';
    }
    
    // Determine urgency
    let urgencyLevel: NewsClassification['urgencyLevel'] = 'routine';
    const urgentKeywords = ['breaking', 'urgent', 'immediate', 'crisis', 'emergency'];
    if (urgentKeywords.some(keyword => fullText.includes(keyword))) {
      urgencyLevel = 'flash';
    } else if (relevanceScore >= 0.5) {
      urgencyLevel = 'urgent';
    } else if (relevanceScore >= 0.3) {
      urgencyLevel = 'priority';
    }
    
    return {
      newsId: `news-${Date.now()}`,
      relevanceScore,
      intelligenceValue,
      eventType,
      urgencyLevel,
      verificationStatus: 'partially_verified',
      keyEntities: this.extractEntitiesFromText(fullText),
      geopoliticalImpact: this.assessGeopoliticalImpact(region || 'Unknown', relevanceScore),
      followUpRequired: relevanceScore >= 0.4,
      relatedEvents: [],
      confidence: 0.7,
      lastUpdated: new Date().toISOString()
    };
  }

  static classifyArms(arms: ArmsEvent): ArmsClassification {
    const weaponText = arms.weaponSystem.toLowerCase();
    const description = arms.description?.toLowerCase() || '';
    
    // Assess risk level based on weapon system
    let riskLevel: ArmsClassification['riskLevel'] = 'LOW';
    let strategicSignificance: ArmsClassification['strategicSignificance'] = 'minimal';
    let technologyLevel: ArmsClassification['technologyLevel'] = 'basic';
    
    // High-risk weapons
    const criticalWeapons = ['nuclear', 'ballistic missile', 'icbm', 'submarine', 'stealth'];
    const highRiskWeapons = ['fighter', 'bomber', 'destroyer', 'frigate', 'cruise missile'];
    const advancedWeapons = ['radar', 'air defense', 'electronic warfare', 'precision'];
    
    if (criticalWeapons.some(weapon => weaponText.includes(weapon))) {
      riskLevel = 'CRITICAL';
      strategicSignificance = 'critical';
      technologyLevel = 'cutting_edge';
    } else if (highRiskWeapons.some(weapon => weaponText.includes(weapon))) {
      riskLevel = 'HIGH';
      strategicSignificance = 'significant';
      technologyLevel = 'advanced';
    } else if (advancedWeapons.some(weapon => weaponText.includes(weapon))) {
      riskLevel = 'MEDIUM';
      strategicSignificance = 'moderate';
      technologyLevel = 'advanced';
    }
    
    // Calculate proliferation risk
    let proliferationRisk = 0.3; // Base risk
    if (technologyLevel === 'cutting_edge') proliferationRisk = 0.8;
    else if (technologyLevel === 'advanced') proliferationRisk = 0.6;
    
    // Assess regional impact
    let regionalImpact: ArmsClassification['regionalImpact'] = 'neutral';
    if (riskLevel === 'CRITICAL') regionalImpact = 'crisis_inducing';
    else if (riskLevel === 'HIGH') regionalImpact = 'destabilizing';
    else if (weaponText.includes('defense') || weaponText.includes('shield')) {
      regionalImpact = 'stabilizing';
    }
    
    // Determine monitoring priority
    let monitoringPriority: ArmsClassification['monitoringPriority'] = 'low';
    if (riskLevel === 'CRITICAL') monitoringPriority = 'critical';
    else if (riskLevel === 'HIGH') monitoringPriority = 'high';
    else if (riskLevel === 'MEDIUM') monitoringPriority = 'medium';
    
    return {
      dealId: arms.id,
      riskLevel,
      strategicSignificance,
      technologyLevel,
      proliferationRisk,
      regionalImpact,
      allianceImplications: [`${arms.sellerCountry}-${arms.buyerCountry} defense cooperation`],
      marketIndicators: [`$${arms.dealValue.toLocaleString()} deal indicates market demand`],
      monitoringPriority,
      controlMeasures: technologyLevel === 'cutting_edge' ? ['Export controls required', 'End-use monitoring'] : [],
      confidence: 0.8,
      lastUpdated: new Date().toISOString()
    };
  }

  private static extractActorsFromText(text: string): string[] {
    const actors: string[] = [];
    const actorPatterns = [
      'military', 'army', 'forces', 'government', 'rebels', 'militants',
      'nato', 'un', 'coalition', 'alliance', 'militia', 'insurgents'
    ];
    
    actorPatterns.forEach(actor => {
      if (text.includes(actor)) actors.push(actor);
    });
    
    return [...new Set(actors)];
  }

  private static extractWeaponsFromText(text: string): string[] {
    const weapons: string[] = [];
    const weaponPatterns = [
      'missile', 'rocket', 'bomb', 'artillery', 'tank', 'fighter',
      'helicopter', 'drone', 'rifle', 'mortar', 'grenade'
    ];
    
    weaponPatterns.forEach(weapon => {
      if (text.includes(weapon)) weapons.push(weapon);
    });
    
    return [...new Set(weapons)];
  }

  private static extractEntitiesFromText(text: string): string[] {
    const entities: string[] = [];
    // Simple entity extraction - in production, use NLP library
    const entityPatterns = [
      'government', 'military', 'president', 'minister', 'commander',
      'organization', 'company', 'agency', 'department'
    ];
    
    entityPatterns.forEach(entity => {
      if (text.includes(entity)) entities.push(entity);
    });
    
    return [...new Set(entities)];
  }

  private static assessGeopoliticalImpact(region: string, relevanceScore: number): string {
    if (relevanceScore >= 0.6) {
      return `High impact event in ${region} with potential for regional destabilization`;
    } else if (relevanceScore >= 0.3) {
      return `Moderate impact in ${region} requiring monitoring for escalation`;
    } else {
      return `Limited impact in ${region} with local significance`;
    }
  }
}

// Integration functions for production use
export function classifyConflictEvent(event: ConflictEvent, useLLM = false): ConflictClassification | null {
  // First validate if this is a real conflict event
  if (!RuleBasedClassifier.isValidConflictEvent(event)) {
    console.log(`Event filtered out as non-conflict: ${event.headline}`);
    return null;
  }
  
  if (useLLM) {
    // TODO: Implement LLM-based classification
    // For now, fallback to rule-based
    console.log('LLM classification not yet implemented, using rule-based fallback');
  }
  
  return RuleBasedClassifier.classifyConflict(event);
}

export function classifyNewsEvent(
  headline: string,
  content: string,
  region?: string,
  tags?: string[],
  useLLM = false
): NewsClassification {
  if (useLLM) {
    // TODO: Implement LLM-based classification
    console.log('LLM classification not yet implemented, using rule-based fallback');
  }
  
  return RuleBasedClassifier.classifyNews(headline, content, region, tags);
}

export function classifyArmsEvent(arms: ArmsEvent, useLLM = false): ArmsClassification {
  if (useLLM) {
    // TODO: Implement LLM-based classification
    console.log('LLM classification not yet implemented, using rule-based fallback');
  }
  
  return RuleBasedClassifier.classifyArms(arms);
}

// Batch processing functions
export function batchClassifyConflicts(events: ConflictEvent[]): ConflictClassification[] {
  return events
    .map(event => classifyConflictEvent(event))
    .filter((classification): classification is ConflictClassification => classification !== null);
}

export function batchClassifyNews(newsItems: Array<{
  headline: string;
  content: string;
  region?: string;
  tags?: string[];
}>): NewsClassification[] {
  return newsItems.map(item => 
    classifyNewsEvent(item.headline, item.content, item.region, item.tags)
  );
}

export function batchClassifyArms(armsDeals: ArmsEvent[]): ArmsClassification[] {
  return armsDeals.map(deal => classifyArmsEvent(deal));
}

const classifiers = {
  RuleBasedClassifier,
  classifyConflictEvent,
  classifyNewsEvent,
  classifyArmsEvent,
  batchClassifyConflicts,
  batchClassifyNews,
  batchClassifyArms
};

export default classifiers;