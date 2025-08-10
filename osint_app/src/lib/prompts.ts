/**
 * Intelligence Prompt Templates
 * Structured prompts for LLM-based analysis and classification
 */

export interface PromptContext {
  headline?: string;
  description?: string;
  content?: string;
  region?: string;
  country?: string;
  weaponSystem?: string;
  buyerCountry?: string;
  sellerCountry?: string;
  dealValue?: number;
  escalationScore?: number;
  tags?: string[];
}

export interface PromptResponse {
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  reasoning: string;
  keyFindings: string[];
}

// Conflict Analysis Prompts
export const CONFLICT_PROMPTS = {
  ESCALATION_ANALYSIS: (context: PromptContext) => `
You are a geopolitical analyst specializing in conflict escalation assessment. Analyze this event and provide a structured assessment.

EVENT DETAILS:
- Headline: "${context.headline}"
- Description: "${context.description || 'N/A'}"
- Location: ${context.country || 'Unknown'}, ${context.region || 'Unknown Region'}
- Current Escalation Score: ${context.escalationScore || 'Not assessed'}
- Tags: ${context.tags?.join(', ') || 'None'}

ANALYSIS REQUIREMENTS:
1. Assess escalation potential on a scale of 1-10
2. Identify key escalation drivers
3. Evaluate threat to regional stability
4. Predict likely next developments
5. Assess international response likelihood

Provide your analysis in this structured format:
ESCALATION_SCORE: [1-10]
THREAT_LEVEL: [LOW/MEDIUM/HIGH/CRITICAL]
PRIMARY_DRIVERS: [List 2-3 key factors]
REGIONAL_IMPACT: [Brief assessment]
NEXT_DEVELOPMENTS: [2-3 likely scenarios]
INTERNATIONAL_RESPONSE: [Likelihood and type]
CONFIDENCE: [0.0-1.0]
`,

  ACTOR_IDENTIFICATION: (context: PromptContext) => `
You are an intelligence analyst identifying key actors in conflict events. Analyze the following event and identify all relevant parties.

EVENT: "${context.headline}"
CONTEXT: "${context.description || 'N/A'}"
REGION: ${context.region || 'Unknown'}

Identify and categorize actors as:
- STATE_ACTORS: National governments, military forces
- NON_STATE_ACTORS: Rebel groups, militias, terrorist organizations
- INTERNATIONAL_ACTORS: UN, NATO, regional organizations
- CIVILIAN_ENTITIES: Affected populations, institutions

For each actor, assess:
1. Role in the conflict
2. Capabilities
3. Objectives
4. Influence level (HIGH/MEDIUM/LOW)

Format your response as structured data.
`,

  WEAPON_IMPACT_ASSESSMENT: (context: PromptContext) => `
You are a defense analyst assessing the strategic impact of weapons used in conflicts. Analyze this event for weapons intelligence.

EVENT: "${context.headline}"
DETAILS: "${context.description || 'N/A'}"

Analyze for:
1. Weapon systems mentioned or implied
2. Technological sophistication level
3. Strategic vs tactical impact
4. Sourcing implications (who likely supplied)
5. Escalation potential based on weapons used

Provide assessment in structured format with confidence levels.
`
};

// News Intelligence Prompts
export const NEWS_PROMPTS = {
  STRATEGIC_SUMMARIZATION: (context: PromptContext) => `
You are a strategic intelligence analyst. Summarize this news article focusing on intelligence value and strategic implications.

HEADLINE: "${context.headline}"
CONTENT: "${context.content || context.description || 'N/A'}"
REGION: ${context.region || 'Global'}

Create a strategic summary that includes:
1. KEY_INTELLIGENCE: Core facts with strategic relevance
2. ACTORS_AFFECTED: Primary and secondary parties
3. GEOPOLITICAL_IMPLICATIONS: Impact on regional/global dynamics
4. ESCALATION_POTENTIAL: Risk assessment
5. MONITORING_PRIORITIES: What to watch for next

Keep summary concise but comprehensive (3-4 sentences max).
`,

  THREAT_CLASSIFICATION: (context: PromptContext) => `
You are a threat assessment specialist. Classify this news event by threat type and severity.

EVENT: "${context.headline}"
CONTEXT: "${context.description || 'N/A'}"
LOCATION: ${context.country || 'Unknown'}, ${context.region || 'Unknown'}

Classify threat as:
- KINETIC: Direct military/violent action
- POLITICAL: Diplomatic/governance threats
- ECONOMIC: Trade/sanctions/economic warfare
- INFORMATION: Propaganda/cyber/influence operations
- HYBRID: Multiple threat types combined

Assess severity and provide reasoning.
`,

  TREND_ANALYSIS: (context: PromptContext) => `
You are a strategic trends analyst. Analyze this event for broader patterns and trends.

EVENT: "${context.headline}"
DETAILS: "${context.description || 'N/A'}"
REGION: ${context.region || 'Global'}
HISTORICAL_CONTEXT: Recent escalation score ${context.escalationScore || 'unknown'}

Identify:
1. TREND_CATEGORY: What broader trend does this represent?
2. PATTERN_INDICATORS: Similar events or escalating patterns
3. TRAJECTORY: Is this trend accelerating or stabilizing?
4. STRATEGIC_SIGNIFICANCE: Long-term implications
5. MONITORING_INDICATORS: Metrics to track trend evolution

Provide analysis with confidence assessment.
`
};

// Arms Trade Intelligence Prompts
export const ARMS_PROMPTS = {
  STRATEGIC_ASSESSMENT: (context: PromptContext) => `
You are a defense trade analyst. Assess the strategic implications of this arms deal.

WEAPON_SYSTEM: ${context.weaponSystem || 'Unknown'}
BUYER: ${context.buyerCountry || 'Unknown'}
SELLER: ${context.sellerCountry || 'Unknown'}
VALUE: $${context.dealValue?.toLocaleString() || 'Unknown'}
DESCRIPTION: "${context.description || 'N/A'}"

Analyze:
1. CAPABILITY_ENHANCEMENT: How does this change buyer's military capabilities?
2. REGIONAL_BALANCE: Impact on regional power dynamics
3. STRATEGIC_RELATIONSHIPS: What does this deal signal about alliances?
4. CONFLICT_POTENTIAL: Does this increase or decrease conflict risk?
5. TECHNOLOGY_TRANSFER: Implications of technology sharing
6. GEOPOLITICAL_SIGNIFICANCE: Broader strategic implications

Provide structured assessment with risk levels.
`,

  PROLIFERATION_RISK: (context: PromptContext) => `
You are a weapons proliferation analyst. Assess proliferation risks of this arms transfer.

WEAPON: ${context.weaponSystem || 'Unknown'}
RECIPIENT: ${context.buyerCountry || 'Unknown'}
SOURCE: ${context.sellerCountry || 'Unknown'}
CONTEXT: "${context.description || 'N/A'}"

Assess:
1. PROLIFERATION_RISK: Likelihood of further transfer
2. DUAL_USE_POTENTIAL: Civilian vs military applications
3. REGIONAL_SPILLOVER: Risk of technology spreading
4. CONTROL_MEASURES: Effectiveness of end-use monitoring
5. STRATEGIC_STABILITY: Impact on arms race dynamics

Rate each factor and provide overall risk assessment.
`,

  MARKET_INTELLIGENCE: (context: PromptContext) => `
You are a defense market analyst. Analyze this arms deal for market intelligence.

DEAL: ${context.weaponSystem || 'Unknown'} to ${context.buyerCountry || 'Unknown'}
VALUE: $${context.dealValue?.toLocaleString() || 'Unknown'}
SELLER: ${context.sellerCountry || 'Unknown'}

Analyze:
1. MARKET_POSITIONING: How does this affect seller's market position?
2. COMPETITIVE_DYNAMICS: Impact on other suppliers
3. DEMAND_INDICATORS: What does this signal about buyer needs?
4. PRICING_ANALYSIS: Value assessment compared to similar systems
5. STRATEGIC_PARTNERSHIPS: Long-term relationship implications

Provide market intelligence summary.
`
};

// Prompt execution utilities
export function buildPrompt(template: string, context: PromptContext): string {
  let prompt = template;
  
  // Replace template variables
  Object.entries(context).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    if (prompt.includes(placeholder)) {
      prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value || 'N/A'));
    }
  });
  
  return prompt;
}

export function validatePromptResponse(response: string): { isValid: boolean; confidence: number } {
  // Basic validation for structured responses
  const hasStructure = response.includes(':') && response.length > 50;
  const hasConfidence = /confidence|certainty|likelihood/i.test(response);
  const hasAssessment = /low|medium|high|critical/i.test(response);
  
  let confidence = 0.5;
  if (hasStructure) confidence += 0.2;
  if (hasConfidence) confidence += 0.2;
  if (hasAssessment) confidence += 0.1;
  
  return {
    isValid: hasStructure && hasAssessment,
    confidence: Math.min(confidence, 1.0)
  };
}

// Structured response parsers
export function parseEscalationResponse(response: string): {
  escalationScore?: number;
  threatLevel?: string;
  drivers?: string[];
  confidence?: number;
} {
  const result: any = {};
  
  // Extract escalation score
  const escalationMatch = response.match(/ESCALATION_SCORE:\s*(\d+)/i);
  if (escalationMatch) {
    result.escalationScore = parseInt(escalationMatch[1], 10);
  }
  
  // Extract threat level
  const threatMatch = response.match(/THREAT_LEVEL:\s*(LOW|MEDIUM|HIGH|CRITICAL)/i);
  if (threatMatch) {
    result.threatLevel = threatMatch[1].toUpperCase();
  }
  
  // Extract confidence
  const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
  if (confidenceMatch) {
    result.confidence = parseFloat(confidenceMatch[1]);
  }
  
  return result;
}

const prompts = {
  CONFLICT_PROMPTS,
  NEWS_PROMPTS,
  ARMS_PROMPTS,
  buildPrompt,
  validatePromptResponse,
  parseEscalationResponse
};

export default prompts;