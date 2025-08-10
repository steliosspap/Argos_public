/**
 * Intelligence Library - Core AI Logic Layer
 * Handles conflict escalation scoring, event classification, and enrichment
 */

import { detectConflictFromText, estimateConflictSeverity, resolveCountryToRegion } from '@/utils/resolve-conflict-region';

// Core interfaces for intelligence operations
export interface ConflictEvent {
  id: string;
  headline: string;
  description?: string;
  country?: string;
  region?: string;
  tags: string[];
  date: string;
  source?: string;
  escalationScore?: number;
  severity?: number;
  conflictType?: string;
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ArmsEvent {
  id: string;
  weaponSystem: string;
  buyerCountry: string;
  sellerCountry?: string;
  dealValue: number;
  date: string;
  description?: string;
  riskScore?: number;
  strategicImpact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface IntelligenceEnrichment {
  escalationScore: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  conflictType: string;
  severity: number;
  keyActors: string[];
  weaponTypes: string[];
  geopoliticalImpact: string;
  confidence: number;
}

// Escalation scoring logic with keyword-based analysis and content filtering
export function calculateEscalationScore(
  headline: string,
  description = '',
  tags: string[] = [],
  existingScore?: number
): number {
  if (existingScore && existingScore >= 1) {
    return existingScore;
  }

  const fullText = `${headline} ${description} ${tags.join(' ')}`.toLowerCase();
  
  // EXCLUSION FILTER: Non-conflict/irrelevant content
  const exclusionKeywords = [
    // Entertainment & Celebrity
    'celebrity', 'actor', 'actress', 'singer', 'musician', 'rapper', 'artist', 'performer',
    'hollywood', 'entertainment', 'movie', 'film', 'tv show', 'television', 'concert',
    'album', 'song', 'music', 'grammy', 'oscar', 'award show', 'red carpet',
    // Specific exclusions based on reported issues
    'diddy', 'p diddy', 'sean combs', 'kardashian', 'kanye', 'taylor swift',
    // Sports
    'football', 'soccer', 'basketball', 'baseball', 'tennis', 'olympics', 'championship',
    'match', 'game', 'tournament', 'player', 'athlete', 'coach', 'league',
    // Business/Tech (unless conflict-related)
    'stock market', 'cryptocurrency', 'bitcoin', 'earnings', 'ipo', 'merger',
    // Weather/Natural (unless causing conflict)
    'weather', 'hurricane', 'earthquake', 'flood', 'wildfire',
    // Health/Medical (unless biological warfare)
    'vaccine', 'health', 'medical', 'doctor', 'hospital' // Note: 'hospital bombed' is in critical keywords
  ];
  
  // Check for exclusion keywords - return minimal score if found
  const hasExcludedContent = exclusionKeywords.some(keyword => fullText.includes(keyword));
  if (hasExcludedContent) {
    // Only proceed if there are strong conflict indicators that override exclusion
    const hasStrongConflictIndicators = fullText.includes('attack') || 
                                       fullText.includes('killed') || 
                                       fullText.includes('bombing') ||
                                       fullText.includes('strike') ||
                                       fullText.includes('war') ||
                                       fullText.includes('military');
    if (!hasStrongConflictIndicators) {
      return 0.5; // Very low score for excluded content
    }
  }
  
  // Critical escalation indicators (score 8-10)
  const criticalKeywords = [
    'nuclear', 'chemical weapons', 'genocide', 'mass killing', 'ethnic cleansing',
    'missile strike', 'ballistic missile', 'cruise missile', 'civilian casualties',
    'hospital bombed', 'school attack', 'refugee camp', 'war crimes', 'massacre',
    'assassination', 'execution', 'torture', 'mass grave'
  ];
  
  // High escalation indicators (score 6-8)
  const highKeywords = [
    'airstrike', 'bombing', 'invasion', 'occupation', 'siege', 'artillery',
    'tank assault', 'military offensive', 'cross-border', 'strategic target',
    'infrastructure attack', 'power plant', 'water facility', 'drone strike',
    'rocket attack', 'mortar attack', 'heavy casualties', 'killed in action'
  ];
  
  // Medium escalation indicators (score 4-6)
  const mediumKeywords = [
    'armed clash', 'firefight', 'skirmish', 'patrol clash', 'border incident',
    'mortar fire', 'sniper attack', 'ambush', 'roadside bomb', 'ied', 'combat',
    'gunfire', 'explosion', 'militant attack', 'insurgent activity'
  ];
  
  // Low escalation indicators (score 2-4)
  const lowKeywords = [
    'tension', 'standoff', 'threat', 'warning', 'mobilization', 'deployment',
    'exercise', 'maneuver', 'buildup', 'reinforcement', 'alert', 'patrol',
    'checkpoint', 'surveillance', 'intelligence'
  ];
  
  // De-escalation indicators (reduce score)
  const deescalationKeywords = [
    'ceasefire', 'truce', 'peace', 'negotiation', 'dialogue', 'agreement',
    'withdrawal', 'pullback', 'humanitarian corridor', 'aid delivery',
    'diplomatic', 'talks', 'resolution'
  ];

  let score = 0;
  let hasAnyMatches = false;

  // Check for critical indicators (highest priority)
  const criticalMatches = criticalKeywords.filter(keyword => fullText.includes(keyword));
  if (criticalMatches.length > 0) {
    score = 8 + Math.min(criticalMatches.length, 2); // Base 8-10
    hasAnyMatches = true;
  }
  
  // Check for high indicators (if no critical found)
  else {
    const highMatches = highKeywords.filter(keyword => fullText.includes(keyword));
    if (highMatches.length > 0) {
      score = 6 + Math.min(highMatches.length, 2); // Base 6-8
      hasAnyMatches = true;
    }
    
    // Check for medium indicators (if no high found)
    else {
      const mediumMatches = mediumKeywords.filter(keyword => fullText.includes(keyword));
      if (mediumMatches.length > 0) {
        score = 4 + Math.min(mediumMatches.length, 2); // Base 4-6
        hasAnyMatches = true;
      }
      
      // Check for low indicators (if no medium found)
      else {
        const lowMatches = lowKeywords.filter(keyword => fullText.includes(keyword));
        if (lowMatches.length > 0) {
          score = 2 + Math.min(lowMatches.length, 1); // Base 2-3
          hasAnyMatches = true;
        }
      }
    }
  }

  // Apply de-escalation modifiers
  const deescalationMatches = deescalationKeywords.filter(keyword => fullText.includes(keyword));
  if (deescalationMatches.length > 0) {
    score = Math.max(1, score - (deescalationMatches.length * 1.5));
  }

  // Cap at 10 and ensure minimum score for any matched content
  if (hasAnyMatches) {
    score = Math.min(10, Math.max(1, score));
  } else {
    score = 1; // Default minimal score for unmatched content
  }

  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

// Classify events based on type and context
export function classifyConflictEvent(event: ConflictEvent): IntelligenceEnrichment {
  const fullText = `${event.headline} ${event.description || ''} ${event.tags.join(' ')}`.toLowerCase();
  
  // Calculate escalation score
  const escalationScore = calculateEscalationScore(
    event.headline,
    event.description,
    event.tags,
    event.escalationScore
  );

  // Determine threat level
  let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (escalationScore >= 8) threatLevel = 'CRITICAL';
  else if (escalationScore >= 6) threatLevel = 'HIGH';
  else if (escalationScore >= 3) threatLevel = 'MEDIUM';
  else threatLevel = 'LOW';

  // Detect conflict type
  const conflictDetection = detectConflictFromText(event.headline, event.description, event.tags);
  
  // Extract key actors
  const keyActors = extractActors(fullText);
  
  // Extract weapon types
  const weaponTypes = extractWeaponTypes(fullText);
  
  // Calculate severity
  const severity = estimateConflictSeverity(event.headline, event.description, escalationScore);
  
  // Generate geopolitical impact assessment
  const geopoliticalImpact = assessGeopoliticalImpact(event, escalationScore, threatLevel);

  return {
    escalationScore,
    threatLevel,
    conflictType: conflictDetection.conflictType,
    severity,
    keyActors,
    weaponTypes,
    geopoliticalImpact,
    confidence: conflictDetection.confidence
  };
}

// Extract key actors from text
function extractActors(text: string): string[] {
  const actors: string[] = [];
  
  // Military/Government actors
  const militaryActors = [
    'military', 'army', 'forces', 'troops', 'soldiers', 'marines', 'navy', 'air force',
    'government', 'regime', 'administration', 'coalition', 'alliance'
  ];
  
  // Non-state actors
  const nonStateActors = [
    'rebels', 'insurgents', 'militants', 'fighters', 'militia', 'paramilitary',
    'terrorists', 'jihadists', 'separatists', 'guerrillas'
  ];
  
  // International actors
  const internationalActors = [
    'nato', 'un', 'united nations', 'eu', 'european union', 'arab league',
    'african union', 'peacekeepers', 'observers'
  ];

  militaryActors.forEach(actor => {
    if (text.includes(actor)) actors.push(actor);
  });
  
  nonStateActors.forEach(actor => {
    if (text.includes(actor)) actors.push(actor);
  });
  
  internationalActors.forEach(actor => {
    if (text.includes(actor)) actors.push(actor);
  });

  return [...new Set(actors)]; // Remove duplicates
}

// Extract weapon types from text
function extractWeaponTypes(text: string): string[] {
  const weapons: string[] = [];
  
  const weaponKeywords = [
    'missile', 'rocket', 'bomb', 'artillery', 'mortar', 'grenade',
    'rifle', 'gun', 'pistol', 'machine gun', 'sniper', 'drone',
    'tank', 'armored', 'helicopter', 'fighter jet', 'warship',
    'nuclear', 'chemical', 'biological', 'cyber', 'explosive'
  ];

  weaponKeywords.forEach(weapon => {
    if (text.includes(weapon)) weapons.push(weapon);
  });

  return [...new Set(weapons)];
}

// Assess geopolitical impact
function assessGeopoliticalImpact(
  event: ConflictEvent,
  escalationScore: number,
  threatLevel: string
): string {
  const region = event.region || 'Unknown';
  const country = event.country || 'Unknown';
  
  if (escalationScore >= 8) {
    return `Critical regional destabilization in ${region}, potential for international intervention and spillover effects`;
  } else if (escalationScore >= 6) {
    return `High impact on ${region} stability, likely to affect neighboring countries and international relations`;
  } else if (escalationScore >= 3) {
    return `Moderate impact on ${country} and regional security, monitoring required for escalation`;
  } else {
    return `Limited local impact in ${country}, unlikely to affect broader regional stability`;
  }
}

// Arms deal risk assessment
export function assessArmsRisk(arms: ArmsEvent): { riskScore: number; strategicImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; concerns: string[] } {
  const concerns: string[] = [];
  let riskScore = 0;
  
  // High-risk weapon systems
  const highRiskWeapons = [
    'fighter', 'bomber', 'missile', 'nuclear', 'submarine', 'destroyer',
    'frigate', 'tank', 'artillery', 'radar', 'air defense'
  ];
  
  const weaponText = arms.weaponSystem.toLowerCase();
  
  // Check for high-risk weapons
  highRiskWeapons.forEach(weapon => {
    if (weaponText.includes(weapon)) {
      riskScore += 2;
      concerns.push(`High-impact weapon system: ${weapon}`);
    }
  });
  
  // Deal value assessment
  if (arms.dealValue > 10000000000) { // $10B+
    riskScore += 3;
    concerns.push('Very high value deal indicating strategic capability transfer');
  } else if (arms.dealValue > 1000000000) { // $1B+
    riskScore += 2;
    concerns.push('High value deal with significant capability enhancement');
  }
  
  // Regional considerations
  const sensitiveRegions = ['Middle East', 'East Asia', 'Eastern Europe'];
  const buyerRegion = resolveCountryToRegion(arms.buyerCountry)?.region;
  
  if (buyerRegion && sensitiveRegions.includes(buyerRegion)) {
    riskScore += 2;
    concerns.push(`Sale to conflict-prone region: ${buyerRegion}`);
  }
  
  // Normalize risk score (0-10)
  riskScore = Math.min(10, riskScore);
  
  let strategicImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (riskScore >= 7) strategicImpact = 'CRITICAL';
  else if (riskScore >= 5) strategicImpact = 'HIGH';
  else if (riskScore >= 3) strategicImpact = 'MEDIUM';
  else strategicImpact = 'LOW';
  
  return {
    riskScore,
    strategicImpact,
    concerns
  };
}

// Prompt templates for LLM integration
export const PROMPT_TEMPLATES = {
  CONFLICT_CLASSIFICATION: `
Analyze this conflict event and provide structured classification:

Event: "{headline}"
Description: "{description}"
Region: "{region}"

Provide analysis in this format:
- Threat Level: [LOW/MEDIUM/HIGH/CRITICAL]
- Primary Actors: [List main parties involved]
- Escalation Factors: [Key factors driving escalation]
- Potential Outcomes: [Likely short-term developments]
- International Implications: [Impact on global/regional stability]
`,

  NEWS_SUMMARIZATION: `
Summarize this defense/conflict news with focus on:
1. Key actors and their actions
2. Geopolitical implications
3. Escalation potential

Headline: "{headline}"
Content: "{content}"

Provide a concise 2-3 sentence summary highlighting strategic significance.
`,

  ARMS_ASSESSMENT: `
Assess this arms deal for strategic implications:

Weapon System: {weaponSystem}
Buyer: {buyerCountry}
Seller: {sellerCountry}
Value: {dealValue}

Analyze:
- Strategic capability change
- Regional balance impact
- Conflict potential
- Policy implications
`
};

// Test functions for validation
export function validateIntelligence() {
  const testEvent: ConflictEvent = {
    id: 'test-1',
    headline: 'Military forces launch missile strike on civilian infrastructure',
    description: 'Multiple cruise missiles hit power plant and water treatment facility',
    country: 'Ukraine',
    region: 'Europe',
    tags: ['military', 'missile', 'infrastructure'],
    date: '2025-01-01',
    source: 'test'
  };

  const enrichment = classifyConflictEvent(testEvent);
  
  return {
    testEvent,
    enrichment,
    isValid: enrichment.escalationScore >= 5 && enrichment.threatLevel === 'HIGH'
  };
}

const intelligence = {
  calculateEscalationScore,
  classifyConflictEvent,
  assessArmsRisk,
  validateIntelligence,
  PROMPT_TEMPLATES
};

export default intelligence;