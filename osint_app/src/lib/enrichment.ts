/**
 * Data Enrichment Functions
 * AI-driven enrichment of conflict, news, and arms deal entries
 */

import { calculateEscalationScore, classifyConflictEvent, assessArmsRisk } from './intelligence';
import { classifyConflictEvent as classifyConflict, classifyNewsEvent, classifyArmsEvent } from './classifiers';
import { DatabaseConflict, DatabaseNewsItem, DatabaseArmsDeal } from './supabase';

// Enrichment result interfaces
export interface ConflictEnrichment {
  escalationScore: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  conflictType: string;
  severity: number;
  primaryActors: string[];
  weaponSystems: string[];
  geopoliticalImpact: string;
  keyDrivers: string[];
  predictedOutcomes: string[];
  internationalResponse: string;
  monitoringPriority: 'low' | 'medium' | 'high' | 'critical';
  lastEnriched: string;
  confidence: number;
}

export interface NewsEnrichment {
  relevanceScore: number;
  intelligenceValue: 'low' | 'medium' | 'high' | 'critical';
  eventType: 'military' | 'political' | 'economic' | 'humanitarian' | 'diplomatic';
  urgencyLevel: 'routine' | 'priority' | 'urgent' | 'flash';
  keyEntities: string[];
  geopoliticalContext: string;
  strategicImplications: string[];
  followUpActions: string[];
  relatedThemes: string[];
  verificationStatus: 'unverified' | 'partially_verified' | 'verified';
  lastEnriched: string;
  confidence: number;
}

export interface ArmsEnrichment {
  riskScore: number;
  strategicImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  technologyLevel: 'basic' | 'advanced' | 'cutting_edge' | 'classified';
  proliferationRisk: number;
  regionalBalance: 'stabilizing' | 'neutral' | 'destabilizing' | 'crisis_inducing';
  allianceSignificance: string[];
  marketTrends: string[];
  controlMeasures: string[];
  competitiveAnalysis: string;
  lastEnriched: string;
  confidence: number;
}

// Main enrichment functions
export function enrichConflictData(conflict: DatabaseConflict): ConflictEnrichment {
  // Convert database format to ConflictEvent
  const event = {
    id: conflict.id,
    headline: conflict.name,
    description: conflict.description,
    country: conflict.country,
    region: conflict.region,
    tags: conflict.conflict_type ? [conflict.conflict_type] : [],
    date: conflict.start_date,
    escalationScore: conflict.escalation_score
  };

  // Get comprehensive classification
  const classification = classifyConflict(event);
  
  // If event was filtered out as non-conflict, return minimal enrichment
  if (!classification) {
    return {
      escalationScore: 1,
      threatLevel: 'LOW',
      conflictType: 'non_conflict',
      severity: 1,
      primaryActors: [],
      weaponSystems: [],
      geopoliticalImpact: 'Minimal - non-conflict event',
      keyDrivers: [],
      predictedOutcomes: [],
      internationalResponse: 'none',
      monitoringPriority: 'low',
      lastEnriched: new Date().toISOString(),
      confidence: 0.1
    };
  }
  
  // Calculate additional enrichment data
  const escalationScore = conflict.escalation_score || 
    calculateEscalationScore(conflict.name, conflict.description, [conflict.conflict_type]);
  
  // Determine key drivers based on conflict type and description
  const keyDrivers = extractKeyDrivers(conflict.description, conflict.conflict_type);
  
  // Predict outcomes based on current status and escalation
  const predictedOutcomes = predictConflictOutcomes(conflict.status, escalationScore, conflict.conflict_type);
  
  // Assess international response likelihood
  const internationalResponse = assessInternationalResponse(
    conflict.region, 
    escalationScore, 
    conflict.casualties || 0
  );
  
  // Determine monitoring priority
  let monitoringPriority: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (escalationScore >= 8) monitoringPriority = 'critical';
  else if (escalationScore >= 6) monitoringPriority = 'high';
  else if (escalationScore >= 3) monitoringPriority = 'medium';

  return {
    escalationScore,
    threatLevel: classification.threatLevel,
    conflictType: classification.conflictType,
    severity: classification.severity,
    primaryActors: classification.primaryActors,
    weaponSystems: classification.weaponSystems,
    geopoliticalImpact: assessGeopoliticalImpact(conflict.region, conflict.country, escalationScore),
    keyDrivers,
    predictedOutcomes,
    internationalResponse,
    monitoringPriority,
    lastEnriched: new Date().toISOString(),
    confidence: classification.confidence
  };
}

export function enrichNewsData(news: DatabaseNewsItem): NewsEnrichment {
  // Get comprehensive classification
  const classification = classifyNewsEvent(
    news.headline,
    news.summary || '',
    news.region,
    news.tags
  );
  
  // Extract strategic implications
  const strategicImplications = extractStrategicImplications(
    news.headline,
    news.summary || '',
    news.region
  );
  
  // Determine follow-up actions
  const followUpActions = determineFollowUpActions(classification.intelligenceValue, classification.urgencyLevel);
  
  // Extract related themes
  const relatedThemes = extractRelatedThemes(news.headline, news.summary || '', news.tags);
  
  // Assess verification status
  const verificationStatus = assessVerificationStatus(news.source, news.url);

  return {
    relevanceScore: classification.relevanceScore,
    intelligenceValue: classification.intelligenceValue,
    eventType: classification.eventType,
    urgencyLevel: classification.urgencyLevel,
    keyEntities: classification.keyEntities,
    geopoliticalContext: classification.geopoliticalImpact,
    strategicImplications,
    followUpActions,
    relatedThemes,
    verificationStatus,
    lastEnriched: new Date().toISOString(),
    confidence: classification.confidence
  };
}

export function enrichArmsData(arms: DatabaseArmsDeal): ArmsEnrichment {
  // Convert to ArmsEvent format
  const armsEvent = {
    id: arms.id,
    weaponSystem: arms.weapon_system,
    buyerCountry: arms.buyer_country,
    sellerCountry: arms.seller_country,
    dealValue: arms.deal_value,
    date: arms.date,
    description: arms.description
  };

  // Get comprehensive classification
  const classification = classifyArmsEvent(armsEvent);
  
  // Get risk assessment
  const riskAssessment = assessArmsRisk(armsEvent);
  
  // Analyze market trends
  const marketTrends = analyzeArmsMarketTrends(arms.weapon_system, arms.deal_value, arms.buyer_country);
  
  // Assess competitive landscape
  const competitiveAnalysis = analyzeCompetitiveLandscape(
    arms.weapon_system,
    arms.seller_country || 'Unknown',
    arms.buyer_country
  );
  
  // Determine control measures needed
  const controlMeasures = determineControlMeasures(classification.technologyLevel, classification.riskLevel);

  return {
    riskScore: riskAssessment.riskScore,
    strategicImpact: riskAssessment.strategicImpact,
    technologyLevel: classification.technologyLevel,
    proliferationRisk: classification.proliferationRisk,
    regionalBalance: classification.regionalImpact,
    allianceSignificance: classification.allianceImplications,
    marketTrends,
    controlMeasures,
    competitiveAnalysis,
    lastEnriched: new Date().toISOString(),
    confidence: classification.confidence
  };
}

// Helper functions for enrichment analysis
function extractKeyDrivers(description: string, conflictType: string): string[] {
  const drivers: string[] = [];
  const text = description.toLowerCase();
  
  // Economic drivers
  if (text.includes('resource') || text.includes('oil') || text.includes('water')) {
    drivers.push('Resource competition');
  }
  
  // Political drivers
  if (text.includes('government') || text.includes('regime') || text.includes('power')) {
    drivers.push('Political instability');
  }
  
  // Ethnic/religious drivers
  if (text.includes('ethnic') || text.includes('religious') || text.includes('sectarian')) {
    drivers.push('Ethnic/religious tensions');
  }
  
  // Territorial drivers
  if (text.includes('border') || text.includes('territory') || text.includes('sovereignty')) {
    drivers.push('Territorial disputes');
  }
  
  // Default based on conflict type
  if (drivers.length === 0) {
    switch (conflictType) {
      case 'civil_war':
        drivers.push('Internal political conflict');
        break;
      case 'territorial_dispute':
        drivers.push('Territorial claims');
        break;
      case 'insurgency':
        drivers.push('Anti-government resistance');
        break;
      default:
        drivers.push('Multiple factors');
    }
  }
  
  return drivers;
}

function predictConflictOutcomes(status: string, escalationScore: number, conflictType: string): string[] {
  const outcomes: string[] = [];
  
  if (escalationScore >= 8) {
    outcomes.push('Escalation to full-scale conflict');
    outcomes.push('International intervention likely');
    outcomes.push('Significant civilian casualties');
  } else if (escalationScore >= 6) {
    outcomes.push('Continued military operations');
    outcomes.push('Regional destabilization');
    outcomes.push('Humanitarian crisis');
  } else if (escalationScore >= 3) {
    outcomes.push('Sporadic violence');
    outcomes.push('Negotiated settlement possible');
    outcomes.push('Monitoring required');
  } else {
    outcomes.push('De-escalation likely');
    outcomes.push('Diplomatic resolution possible');
    outcomes.push('Stability returning');
  }
  
  return outcomes;
}

function assessInternationalResponse(region: string, escalationScore: number, casualties: number): string {
  if (escalationScore >= 8 || casualties > 10000) {
    return 'Military intervention or peacekeeping deployment likely';
  } else if (escalationScore >= 6 || casualties > 1000) {
    return 'Diplomatic pressure and sanctions expected';
  } else if (escalationScore >= 3) {
    return 'Diplomatic engagement and monitoring';
  } else {
    return 'Limited international attention';
  }
}

function assessGeopoliticalImpact(region: string, country: string, escalationScore: number): string {
  const impactLevel = escalationScore >= 6 ? 'high' : escalationScore >= 3 ? 'medium' : 'low';
  
  return `${impactLevel.charAt(0).toUpperCase() + impactLevel.slice(1)} impact on ${region} stability. ` +
         `Conflict in ${country} affects regional security dynamics and may influence ` +
         `international relations in the ${region} theater.`;
}

function extractStrategicImplications(headline: string, summary: string, region?: string): string[] {
  const implications: string[] = [];
  const text = `${headline} ${summary}`.toLowerCase();
  
  if (text.includes('military') || text.includes('defense')) {
    implications.push('Military capability changes');
  }
  
  if (text.includes('alliance') || text.includes('partnership')) {
    implications.push('Alliance relationship shifts');
  }
  
  if (text.includes('economic') || text.includes('trade')) {
    implications.push('Economic/trade implications');
  }
  
  if (text.includes('nuclear') || text.includes('missile')) {
    implications.push('Strategic weapons implications');
  }
  
  if (region && ['Middle East', 'East Asia', 'Europe'].includes(region)) {
    implications.push(`Regional balance in ${region}`);
  }
  
  return implications.length > 0 ? implications : ['General strategic interest'];
}

function determineFollowUpActions(intelligenceValue: string, urgencyLevel: string): string[] {
  const actions: string[] = [];
  
  if (intelligenceValue === 'critical' || urgencyLevel === 'flash') {
    actions.push('Immediate assessment required');
    actions.push('Notify senior analysts');
    actions.push('Continuous monitoring');
  } else if (intelligenceValue === 'high' || urgencyLevel === 'urgent') {
    actions.push('Priority analysis');
    actions.push('Verify with additional sources');
    actions.push('Track developments');
  } else if (intelligenceValue === 'medium' || urgencyLevel === 'priority') {
    actions.push('Regular monitoring');
    actions.push('Include in daily briefings');
  } else {
    actions.push('Archive for reference');
    actions.push('Periodic review');
  }
  
  return actions;
}

function extractRelatedThemes(headline: string, summary: string, tags: string[]): string[] {
  const themes: Set<string> = new Set();
  const text = `${headline} ${summary} ${tags.join(' ')}`.toLowerCase();
  
  const themeKeywords = {
    'Cyber Warfare': ['cyber', 'hacking', 'digital', 'information warfare'],
    'Nuclear Proliferation': ['nuclear', 'uranium', 'enrichment', 'proliferation'],
    'Terrorism': ['terror', 'extremist', 'jihadist', 'bombing'],
    'Arms Trade': ['weapons', 'arms', 'missile', 'fighter', 'tank'],
    'Regional Security': ['regional', 'neighbor', 'border', 'alliance'],
    'Humanitarian Crisis': ['refugee', 'civilian', 'humanitarian', 'aid'],
    'Economic Warfare': ['sanctions', 'embargo', 'trade', 'economic'],
    'Diplomatic Relations': ['diplomatic', 'embassy', 'negotiation', 'treaty']
  };
  
  Object.entries(themeKeywords).forEach(([theme, keywords]) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      themes.add(theme);
    }
  });
  
  return Array.from(themes);
}

function assessVerificationStatus(source: string, url?: string): 'unverified' | 'partially_verified' | 'verified' {
  const reliableSources = [
    'Reuters', 'AP', 'BBC', 'CNN', 'Al Jazeera', 'Defense News',
    'Jane\'s', 'SIPRI', 'International Crisis Group'
  ];
  
  if (reliableSources.some(reliable => source.includes(reliable))) {
    return 'verified';
  } else if (url && (url.includes('gov') || url.includes('mil') || url.includes('org'))) {
    return 'partially_verified';
  } else {
    return 'unverified';
  }
}

function analyzeArmsMarketTrends(weaponSystem: string, dealValue: number, buyerCountry: string): string[] {
  const trends: string[] = [];
  
  if (dealValue > 5000000000) {
    trends.push('Mega-deal indicating strategic procurement');
  }
  
  if (weaponSystem.toLowerCase().includes('fighter') || weaponSystem.toLowerCase().includes('aircraft')) {
    trends.push('Air superiority modernization trend');
  }
  
  if (weaponSystem.toLowerCase().includes('missile') || weaponSystem.toLowerCase().includes('defense')) {
    trends.push('Defensive capability enhancement');
  }
  
  trends.push(`${buyerCountry} military modernization program`);
  
  return trends;
}

function analyzeCompetitiveLandscape(weaponSystem: string, seller: string, buyer: string): string {
  return `${seller} competing in ${weaponSystem} market segment. ` +
         `Sale to ${buyer} strengthens ${seller}'s position in regional defense market. ` +
         `Potential implications for competitor nations' market share.`;
}

function determineControlMeasures(techLevel: string, riskLevel: string): string[] {
  const measures: string[] = [];
  
  if (techLevel === 'cutting_edge' || riskLevel === 'CRITICAL') {
    measures.push('Strict export controls');
    measures.push('End-use monitoring required');
    measures.push('Technology transfer restrictions');
  } else if (techLevel === 'advanced' || riskLevel === 'HIGH') {
    measures.push('Export license required');
    measures.push('End-use verification');
  } else if (riskLevel === 'MEDIUM') {
    measures.push('Standard export procedures');
    measures.push('Periodic compliance checks');
  }
  
  return measures;
}

// Batch enrichment functions
export function batchEnrichConflicts(conflicts: DatabaseConflict[]): ConflictEnrichment[] {
  return conflicts.map(conflict => enrichConflictData(conflict));
}

export function batchEnrichNews(newsItems: DatabaseNewsItem[]): NewsEnrichment[] {
  return newsItems.map(news => enrichNewsData(news));
}

export function batchEnrichArms(armsDeals: DatabaseArmsDeal[]): ArmsEnrichment[] {
  return armsDeals.map(arms => enrichArmsData(arms));
}

const enrichment = {
  enrichConflictData,
  enrichNewsData,
  enrichArmsData,
  batchEnrichConflicts,
  batchEnrichNews,
  batchEnrichArms
};

export default enrichment;