/**
 * Severity Logic and Classification System
 * Defines how events are categorized by severity level
 */

export interface SeverityClassification {
  level: 'low' | 'medium' | 'high' | 'critical';
  escalationScore: number; // 1-10
  color: string;
  icon: string;
  description: string;
  examples: string[];
}

/**
 * Severity classifications with clear criteria
 */
export const SEVERITY_CLASSIFICATIONS: Record<string, SeverityClassification> = {
  critical: {
    level: 'critical',
    escalationScore: 9,
    color: 'red',
    icon: '🚨',
    description: 'Existential threats or large-scale military operations',
    examples: [
      'Nuclear threats or incidents',
      'Major military invasions',
      'Large-scale chemical/biological attacks',
      'Collapse of government',
      'Mass casualty events (100+ deaths)',
      'Strategic military operations'
    ]
  },
  high: {
    level: 'high',
    escalationScore: 7,
    color: 'orange',
    icon: '⚠️',
    description: 'Significant military actions or severe security incidents',
    examples: [
      'Cross-border military strikes',
      'Major terrorist attacks',
      'Artillery/missile exchanges',
      'Significant civilian casualties (10-100 deaths)',
      'Military mobilizations',
      'Coup attempts'
    ]
  },
  medium: {
    level: 'medium',
    escalationScore: 5,
    color: 'yellow',
    icon: '⚡',
    description: 'Localized conflicts or moderate security incidents',
    examples: [
      'Border skirmishes',
      'Targeted assassinations',
      'Civil unrest with violence',
      'Cyber attacks on infrastructure',
      'Small arms fire exchanges',
      'Political arrests'
    ]
  },
  low: {
    level: 'low',
    escalationScore: 3,
    color: 'blue',
    icon: 'ℹ️',
    description: 'Minor incidents or diplomatic tensions',
    examples: [
      'Peaceful protests',
      'Diplomatic expulsions',
      'Trade sanctions',
      'Military exercises',
      'Border closures',
      'Political statements/threats'
    ]
  }
};

/**
 * Keywords that indicate severity levels
 */
export const SEVERITY_KEYWORDS = {
  critical: [
    'nuclear', 'massacre', 'genocide', 'chemical weapons', 'biological weapons',
    'invasion', 'war declaration', 'mass casualties', 'hundreds killed',
    'government collapse', 'capital fallen', 'strategic bombing'
  ],
  high: [
    'airstrike', 'missile strike', 'artillery', 'bombing', 'explosion',
    'terrorist attack', 'dozens killed', 'coup', 'military offensive',
    'cross-border attack', 'assassination', 'hostage crisis'
  ],
  medium: [
    'clashes', 'firefight', 'skirmish', 'riot', 'cyber attack',
    'casualties', 'wounded', 'arrest', 'raid', 'incursion',
    'protest violence', 'police action'
  ],
  low: [
    'protest', 'sanction', 'diplomatic', 'exercise', 'drill',
    'statement', 'warning', 'closure', 'suspension', 'talks',
    'negotiation', 'meeting'
  ]
};

/**
 * Calculate severity based on event data
 */
export function calculateSeverity(event: {
  title?: string;
  summary?: string;
  event_type?: string;
  tags?: string[];
  casualties?: number;
}): {
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  reasoning: string[];
} {
  const reasoning: string[] = [];
  let points = 0;
  
  const text = `${event.title || ''} ${event.summary || ''}`.toLowerCase();
  
  // Check for critical keywords
  for (const keyword of SEVERITY_KEYWORDS.critical) {
    if (text.includes(keyword)) {
      points += 10;
      reasoning.push(`Contains critical keyword: "${keyword}"`);
    }
  }
  
  // Check for high severity keywords
  for (const keyword of SEVERITY_KEYWORDS.high) {
    if (text.includes(keyword)) {
      points += 7;
      reasoning.push(`Contains high severity keyword: "${keyword}"`);
    }
  }
  
  // Check for medium severity keywords
  for (const keyword of SEVERITY_KEYWORDS.medium) {
    if (text.includes(keyword)) {
      points += 4;
      reasoning.push(`Contains medium severity keyword: "${keyword}"`);
    }
  }
  
  // Check event type
  if (event.event_type) {
    switch (event.event_type) {
      case 'military_conflict':
      case 'terrorist_attack':
        points += 5;
        reasoning.push(`Event type indicates violence: ${event.event_type}`);
        break;
      case 'civil_unrest':
      case 'cyber_attack':
        points += 3;
        reasoning.push(`Event type indicates unrest: ${event.event_type}`);
        break;
      case 'diplomatic':
      case 'economic':
        points += 1;
        reasoning.push(`Event type is non-violent: ${event.event_type}`);
        break;
    }
  }
  
  // Check casualties if available
  if (event.casualties !== undefined) {
    if (event.casualties >= 100) {
      points += 10;
      reasoning.push(`Mass casualties: ${event.casualties}+`);
    } else if (event.casualties >= 10) {
      points += 7;
      reasoning.push(`Significant casualties: ${event.casualties}`);
    } else if (event.casualties > 0) {
      points += 4;
      reasoning.push(`Casualties reported: ${event.casualties}`);
    }
  }
  
  // Determine severity based on points
  let severity: 'low' | 'medium' | 'high' | 'critical';
  let confidence: number;
  
  if (points >= 20) {
    severity = 'critical';
    confidence = Math.min(points / 30, 1);
  } else if (points >= 12) {
    severity = 'high';
    confidence = Math.min(points / 20, 1);
  } else if (points >= 6) {
    severity = 'medium';
    confidence = Math.min(points / 12, 1);
  } else {
    severity = 'low';
    confidence = Math.min(points / 6, 1);
  }
  
  return { severity, confidence, reasoning };
}

/**
 * Get human-readable severity explanation
 */
export function getSeverityExplanation(severity: string): string {
  const classification = SEVERITY_CLASSIFICATIONS[severity];
  if (!classification) {
    return 'Unknown severity level';
  }
  
  return `${classification.icon} ${classification.level.toUpperCase()}: ${classification.description}`;
}

/**
 * Validate if severity assignment is reasonable
 */
export function validateSeverity(
  event: any,
  assignedSeverity: string
): {
  isValid: boolean;
  suggestion?: string;
  reason?: string;
} {
  const calculated = calculateSeverity(event);
  
  if (calculated.severity === assignedSeverity) {
    return { isValid: true };
  }
  
  // Allow one level of difference with low confidence
  const severityLevels = ['low', 'medium', 'high', 'critical'];
  const assignedIndex = severityLevels.indexOf(assignedSeverity);
  const calculatedIndex = severityLevels.indexOf(calculated.severity);
  
  if (Math.abs(assignedIndex - calculatedIndex) === 1 && calculated.confidence < 0.7) {
    return { isValid: true };
  }
  
  return {
    isValid: false,
    suggestion: calculated.severity,
    reason: calculated.reasoning.join('; ')
  };
}