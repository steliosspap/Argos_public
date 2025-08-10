/**
 * Event relevance evaluation utilities
 * Determines when events should be considered stale or no longer relevant
 */

interface EventRelevanceConfig {
  baseRelevanceHours: number; // Base hours before event starts losing relevance
  severityMultipliers: Record<string, number>; // Multipliers based on severity
  eventTypeMultipliers: Record<string, number>; // Multipliers based on event type
  minimumRelevanceHours: number; // Minimum hours to keep any event
}

const DEFAULT_CONFIG: EventRelevanceConfig = {
  baseRelevanceHours: 24, // Base 24 hours
  severityMultipliers: {
    critical: 4.0,  // Critical events stay relevant 4x longer (96 hours)
    high: 2.5,      // High severity 2.5x longer (60 hours)
    medium: 1.5,    // Medium severity 1.5x longer (36 hours)
    low: 1.0        // Low severity uses base time (24 hours)
  },
  eventTypeMultipliers: {
    military_conflict: 3.0,  // Military conflicts stay relevant longer
    diplomatic: 2.0,         // Diplomatic events have extended relevance
    humanitarian: 2.5,       // Humanitarian crises need extended attention
    civil_unrest: 1.5,       // Civil unrest moderate extension
    economic: 1.0,           // Economic events standard relevance
    cyber: 0.75              // Cyber events may resolve quickly
  },
  minimumRelevanceHours: 6 // Never mark events irrelevant before 6 hours
};

/**
 * Calculate relevance score for an event (0-1)
 * 1 = fully relevant, 0 = no longer relevant
 */
export function calculateRelevanceScore(
  event: {
    timestamp: string;
    severity: string;
    event_type?: string;
    escalation_score?: number;
  },
  config: EventRelevanceConfig = DEFAULT_CONFIG
): number {
  const now = new Date();
  const eventTime = new Date(event.timestamp);
  const hoursSinceEvent = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
  
  // If event is in the future, it's fully relevant
  if (hoursSinceEvent < 0) return 1;
  
  // If within minimum relevance window, always fully relevant
  if (hoursSinceEvent < config.minimumRelevanceHours) return 1;
  
  // Calculate total relevance hours based on multipliers
  const severityMultiplier = config.severityMultipliers[event.severity] || 1;
  const eventTypeMultiplier = config.eventTypeMultipliers[event.event_type || ''] || 1;
  
  // If escalation score is high, add extra relevance time
  const escalationBonus = (event.escalation_score || 5) > 7 ? 1.5 : 1;
  
  const totalRelevanceHours = config.baseRelevanceHours * 
    severityMultiplier * 
    eventTypeMultiplier * 
    escalationBonus;
  
  // Calculate decay
  if (hoursSinceEvent >= totalRelevanceHours) {
    // Event has passed its relevance window
    return 0;
  }
  
  // Linear decay from 1 to 0 over the relevance period
  // But with a slower decay curve (using sqrt for non-linear decay)
  const decayProgress = hoursSinceEvent / totalRelevanceHours;
  const relevanceScore = 1 - Math.sqrt(decayProgress);
  
  return Math.max(0, Math.min(1, relevanceScore));
}

/**
 * Check if an event is still relevant
 */
export function isEventRelevant(
  event: {
    timestamp: string;
    severity: string;
    event_type?: string;
    escalation_score?: number;
  },
  relevanceThreshold: number = 0.1
): boolean {
  return calculateRelevanceScore(event) >= relevanceThreshold;
}

/**
 * Filter events by relevance
 */
export function filterRelevantEvents<T extends {
  timestamp: string;
  severity: string;
  event_type?: string;
  escalation_score?: number;
}>(
  events: T[],
  relevanceThreshold: number = 0.1
): T[] {
  return events.filter(event => isEventRelevant(event, relevanceThreshold));
}

/**
 * Sort events by relevance score (most relevant first)
 */
export function sortByRelevance<T extends {
  timestamp: string;
  severity: string;
  event_type?: string;
  escalation_score?: number;
}>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const scoreA = calculateRelevanceScore(a);
    const scoreB = calculateRelevanceScore(b);
    return scoreB - scoreA;
  });
}

/**
 * Get a human-readable relevance status
 */
export function getRelevanceStatus(relevanceScore: number): {
  status: string;
  color: string;
  description: string;
} {
  if (relevanceScore >= 0.8) {
    return {
      status: 'Fresh',
      color: 'text-green-400',
      description: 'Recently reported'
    };
  } else if (relevanceScore >= 0.5) {
    return {
      status: 'Current',
      color: 'text-blue-400',
      description: 'Still developing'
    };
  } else if (relevanceScore >= 0.2) {
    return {
      status: 'Aging',
      color: 'text-yellow-400',
      description: 'Older but relevant'
    };
  } else if (relevanceScore > 0) {
    return {
      status: 'Stale',
      color: 'text-gray-400',
      description: 'Limited relevance'
    };
  } else {
    return {
      status: 'Archived',
      color: 'text-gray-600',
      description: 'Historical record'
    };
  }
}