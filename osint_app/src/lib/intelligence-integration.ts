/**
 * Intelligence Integration Module
 * Production-ready bridge between intelligence library and live pipeline
 */

import { calculateEscalationScore, classifyConflictEvent, assessArmsRisk } from './intelligence';
import { enrichNewsData, enrichConflictData, enrichArmsData } from './enrichment';
import { classifyNewsEvent, classifyConflictEvent as classifyConflict, classifyArmsEvent } from './classifiers';
import { CONFLICT_PROMPTS, NEWS_PROMPTS, ARMS_PROMPTS } from './prompts';

// Production pipeline interfaces
export interface PipelineNewsItem {
  id?: string;
  title: string;
  headline?: string;
  summary?: string;
  content?: string;
  region?: string;
  country?: string;
  source: string;
  url?: string;
  published_at?: string;
  date?: string;
  tags?: string[];
  confidence_score?: number;
  relevance_score?: number;
  escalation_score?: number;
}

export interface PipelineAnalysisResult {
  escalation_score: number;
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  classification: {
    conflict_type: string;
    event_type: string;
    intelligence_value: string;
    urgency_level: string;
  };
  enrichment: {
    key_actors: string[];
    weapon_systems: string[];
    strategic_implications: string[];
    monitoring_priority: string;
    geopolitical_impact: string;
  };
  metadata: {
    processed_at: string;
    version: string;
    analysis_type: 'rule_based' | 'llm_enhanced';
  };
}

// Enhanced escalation scoring for production pipeline integration
export function analyzeNewsForPipeline(newsItem: PipelineNewsItem): PipelineAnalysisResult {
  const timestamp = new Date().toISOString();
  
  // Normalize input data
  const title = newsItem.headline || newsItem.title || '';
  const content = newsItem.summary || newsItem.content || '';
  const region = newsItem.region || 'Unknown';
  const tags = newsItem.tags || [];
  
  // Calculate enhanced escalation score
  const escalationScore = calculateEscalationScore(
    title,
    content,
    tags,
    newsItem.escalation_score
  );
  
  // Determine threat level
  let threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (escalationScore >= 8) threatLevel = 'CRITICAL';
  else if (escalationScore >= 6) threatLevel = 'HIGH';
  else if (escalationScore >= 3) threatLevel = 'MEDIUM';
  else threatLevel = 'LOW';
  
  // Classify news event
  const newsClassification = classifyNewsEvent(title, content, region, tags);
  
  // Convert for conflict analysis if relevant
  const conflictEvent = {
    id: newsItem.id || `news-${Date.now()}`,
    headline: title,
    description: content,
    country: newsItem.country,
    region: region,
    tags: tags,
    date: newsItem.published_at || newsItem.date || timestamp,
    source: newsItem.source
  };
  
  // Enrich with intelligence analysis
  const enrichment = enrichNewsData({
    id: newsItem.id || `news-${Date.now()}`,
    headline: title,
    source: newsItem.source,
    region: region,
    date: newsItem.published_at || newsItem.date || timestamp,
    url: newsItem.url,
    summary: content,
    tags: tags
  });
  
  // Extract key intelligence components
  const keyActors = extractActorsFromText(`${title} ${content}`);
  const weaponSystems = extractWeaponTypesFromText(`${title} ${content}`);
  const strategicImplications = assessStrategicImplications(title, content, region, escalationScore);
  
  return {
    escalation_score: escalationScore,
    threat_level: threatLevel,
    confidence: Math.max(
      newsClassification.confidence,
      enrichment.confidence,
      0.7 // Minimum confidence for rule-based analysis
    ),
    classification: {
      conflict_type: newsClassification.eventType === 'military' ? 'active_conflict' : 'tension',
      event_type: newsClassification.eventType,
      intelligence_value: newsClassification.intelligenceValue,
      urgency_level: newsClassification.urgencyLevel
    },
    enrichment: {
      key_actors: keyActors,
      weapon_systems: weaponSystems,
      strategic_implications: strategicImplications,
      monitoring_priority: determineMonitoringPriority(escalationScore, threatLevel),
      geopolitical_impact: enrichment.geopoliticalContext
    },
    metadata: {
      processed_at: timestamp,
      version: '1.0.0',
      analysis_type: 'rule_based'
    }
  };
}

// Enhanced scoring specifically for the ingestion pipeline with improved filtering
export function computeEnhancedEscalationScore(newsData: {
  title: string;
  summary?: string;
  description?: string;
  tags?: string[];
  source?: string;
  region?: string;
}): { score: number; confidence: number; factors: string[] } {
  
  const factors: string[] = [];
  
  // Use improved core intelligence library (now includes exclusion filtering)
  const baseScore = calculateEscalationScore(
    newsData.title,
    newsData.summary || newsData.description || '',
    newsData.tags || []
  );
  
  // If content was excluded/filtered, return early with low score
  if (baseScore <= 0.5) {
    return {
      score: baseScore,
      confidence: 0.9, // High confidence in exclusion
      factors: ['Content filtered as non-conflict/irrelevant']
    };
  }
  
  let adjustedScore = baseScore;
  let confidence = 0.8; // Base confidence for rule-based scoring
  
  // Add factor analysis for transparency
  if (baseScore >= 8) {
    factors.push('Critical escalation indicators detected');
  } else if (baseScore >= 6) {
    factors.push('High escalation indicators detected');
  } else if (baseScore >= 4) {
    factors.push('Medium escalation indicators detected');
  } else if (baseScore >= 2) {
    factors.push('Low escalation indicators detected');
  }
  
  // Source credibility adjustment
  const highCredibilitySources = [
    'BBC', 'Reuters', 'AP', 'Defense News', 'Jane\'s', 'Crisis24',
    'International Crisis Group', 'SIPRI', 'ACLED', 'Al Jazeera'
  ];
  
  if (newsData.source && highCredibilitySources.some(source => 
    newsData.source?.toLowerCase().includes(source.toLowerCase())
  )) {
    confidence += 0.1;
    factors.push('High credibility source');
  }
  
  // Regional escalation modifiers
  const highTensionRegions = ['Middle East', 'Eastern Europe', 'East Asia', 'South China Sea', 'South Asia'];
  if (newsData.region && highTensionRegions.includes(newsData.region)) {
    adjustedScore += 0.5; // Reduced from 1 to avoid over-inflation
    factors.push(`High tension region: ${newsData.region}`);
  }
  
  // Temporal urgency detection
  const urgentKeywords = ['breaking', 'urgent', 'immediate', 'just in', 'developing'];
  const fullText = `${newsData.title} ${newsData.summary || ''}`.toLowerCase();
  
  if (urgentKeywords.some(keyword => fullText.includes(keyword))) {
    adjustedScore += 0.5;
    factors.push('Urgent/breaking news indicator');
  }
  
  // Multi-actor involvement boost
  const actorCount = extractActorsFromText(fullText).length;
  if (actorCount >= 3) {
    adjustedScore += 1;
    factors.push(`Multiple actors involved (${actorCount})`);
  }
  
  // Nuclear/WMD threat detection
  const wmdKeywords = ['nuclear', 'chemical weapon', 'biological weapon', 'wmd', 'icbm'];
  if (wmdKeywords.some(keyword => fullText.includes(keyword))) {
    adjustedScore = Math.max(adjustedScore, 8); // Minimum score of 8 for WMD threats
    factors.push('WMD/Nuclear threat detected');
    confidence += 0.1;
  }
  
  // Civilian casualty impact
  const casualtyPattern = /(\d+)[\s\w]*(?:killed|dead|casualties|wounded)/i;
  const casualtyMatch = fullText.match(casualtyPattern);
  if (casualtyMatch) {
    const casualties = parseInt(casualtyMatch[1], 10);
    if (casualties >= 100) {
      adjustedScore += 2;
      factors.push(`High casualty count: ${casualties}`);
    } else if (casualties >= 10) {
      adjustedScore += 1;
      factors.push(`Significant casualties: ${casualties}`);
    }
  }
  
  // Cap score at 10 and ensure minimum of 1
  adjustedScore = Math.max(1, Math.min(10, Math.round(adjustedScore * 10) / 10));
  confidence = Math.min(1.0, confidence);
  
  return {
    score: adjustedScore,
    confidence,
    factors
  };
}

// Batch analysis for pipeline processing
export function batchAnalyzeNews(newsItems: PipelineNewsItem[]): PipelineAnalysisResult[] {
  return newsItems.map(item => analyzeNewsForPipeline(item));
}

// Helper functions for intelligence extraction
function extractActorsFromText(text: string): string[] {
  const actors: string[] = [];
  const lowercaseText = text.toLowerCase();
  
  // State actors
  const statePatterns = [
    'military', 'army', 'navy', 'air force', 'government', 'ministry',
    'president', 'prime minister', 'defense minister', 'forces'
  ];
  
  // Non-state actors  
  const nonStatePatterns = [
    'rebels', 'insurgents', 'militants', 'fighters', 'militia',
    'terrorist', 'extremist', 'separatist', 'opposition'
  ];
  
  // International actors
  const internationalPatterns = [
    'nato', 'un', 'united nations', 'eu', 'european union',
    'coalition', 'peacekeepers', 'observers'
  ];
  
  [...statePatterns, ...nonStatePatterns, ...internationalPatterns].forEach(pattern => {
    if (lowercaseText.includes(pattern)) {
      actors.push(pattern);
    }
  });
  
  return [...new Set(actors)];
}

function extractWeaponTypesFromText(text: string): string[] {
  const weapons: string[] = [];
  const lowercaseText = text.toLowerCase();
  
  const weaponPatterns = [
    'missile', 'rocket', 'bomb', 'artillery', 'mortar', 'drone',
    'fighter jet', 'helicopter', 'tank', 'armored vehicle',
    'rifle', 'gun', 'explosive', 'grenade', 'sniper',
    'nuclear', 'chemical', 'biological', 'cyber'
  ];
  
  weaponPatterns.forEach(weapon => {
    if (lowercaseText.includes(weapon)) {
      weapons.push(weapon);
    }
  });
  
  return [...new Set(weapons)];
}

function assessStrategicImplications(
  title: string, 
  content: string, 
  region: string, 
  escalationScore: number
): string[] {
  const implications: string[] = [];
  const fullText = `${title} ${content}`.toLowerCase();
  
  // Regional implications
  if (escalationScore >= 6) {
    implications.push(`High risk of escalation in ${region}`);
  }
  
  // Alliance implications
  if (fullText.includes('nato') || fullText.includes('alliance')) {
    implications.push('Alliance relationships affected');
  }
  
  // Economic implications
  if (fullText.includes('sanctions') || fullText.includes('embargo') || fullText.includes('trade')) {
    implications.push('Economic/trade impact');
  }
  
  // Nuclear implications
  if (fullText.includes('nuclear') || fullText.includes('atomic')) {
    implications.push('Nuclear security concerns');
  }
  
  // Humanitarian implications
  if (fullText.includes('refugee') || fullText.includes('civilian') || fullText.includes('humanitarian')) {
    implications.push('Humanitarian crisis potential');
  }
  
  // Default strategic interest
  if (implications.length === 0) {
    implications.push('Regional security interest');
  }
  
  return implications;
}

function determineMonitoringPriority(escalationScore: number, threatLevel: string): string {
  if (threatLevel === 'CRITICAL' || escalationScore >= 8) {
    return 'critical';
  } else if (threatLevel === 'HIGH' || escalationScore >= 6) {
    return 'high';
  } else if (threatLevel === 'MEDIUM' || escalationScore >= 3) {
    return 'medium';
  } else {
    return 'low';
  }
}

// Validation utilities for pipeline integration
export function validateAnalysisResult(result: PipelineAnalysisResult): { 
  isValid: boolean; 
  errors: string[]; 
} {
  const errors: string[] = [];
  
  // Score validation
  if (result.escalation_score < 0 || result.escalation_score > 10) {
    errors.push('Escalation score must be between 0 and 10');
  }
  
  // Confidence validation
  if (result.confidence < 0 || result.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  
  // Threat level validation
  const validThreatLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validThreatLevels.includes(result.threat_level)) {
    errors.push('Invalid threat level');
  }
  
  // Required fields validation
  if (!result.metadata.processed_at) {
    errors.push('Missing processed_at timestamp');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export for pipeline integration
const intelligenceIntegration = {
  analyzeNewsForPipeline,
  computeEnhancedEscalationScore,
  batchAnalyzeNews,
  validateAnalysisResult
};

export default intelligenceIntegration;