/**
 * Arms Deal Intelligence Analysis Module
 * Advanced intelligence analysis for arms trade and defense procurement
 */

// Arms deal interfaces based on schema
export interface ArmsAnalysisInput {
  id: string;
  buyer_country: string;
  seller_country?: string;
  weapon_type: string;
  quantity?: number;
  value_usd: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  delivery_date?: string;
  contract_date?: string;
  description?: string;
  sources?: string[];
}

export interface ArmsIntelligenceResult {
  deal_id: string;
  strategic_assessment: {
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    proliferation_risk: number; // 0-10 scale
    regional_impact: 'stabilizing' | 'neutral' | 'destabilizing' | 'crisis_inducing';
    technology_transfer_level: 'basic' | 'advanced' | 'sensitive' | 'classified';
  };
  geopolitical_analysis: {
    alliance_implications: string[];
    balance_of_power_impact: string;
    conflict_escalation_potential: number; // 0-10 scale
    strategic_significance: string;
  };
  market_intelligence: {
    deal_classification: 'routine' | 'significant' | 'major' | 'strategic';
    market_trends: string[];
    competitive_analysis: string;
    pricing_assessment: 'below_market' | 'market_rate' | 'premium' | 'exceptional';
  };
  monitoring_priorities: {
    oversight_level: 'routine' | 'enhanced' | 'intensive' | 'critical';
    key_indicators: string[];
    follow_up_actions: string[];
    reporting_requirements: string[];
  };
  confidence: number; // 0-1 scale
  processed_at: string;
}

// Regional tension mappings for strategic analysis
const HIGH_TENSION_REGIONS = {
  'Middle East': ['Iran', 'Israel', 'Saudi Arabia', 'Turkey', 'UAE', 'Egypt', 'Syria', 'Iraq'],
  'East Asia': ['China', 'Taiwan', 'North Korea', 'South Korea', 'Japan'],
  'Eastern Europe': ['Russia', 'Ukraine', 'Belarus', 'Poland', 'Baltic States'],
  'South Asia': ['India', 'Pakistan', 'Afghanistan'],
  'South China Sea': ['China', 'Vietnam', 'Philippines', 'Malaysia', 'Taiwan']
};

// Strategic weapon system classifications
const STRATEGIC_WEAPONS = {
  CRITICAL: [
    'nuclear', 'icbm', 'ballistic missile', 'submarine-launched ballistic missile',
    'nuclear submarine', 'stealth bomber', 'stealth fighter'
  ],
  HIGH: [
    'fighter aircraft', 'combat aircraft', 'destroyer', 'frigate', 'tank',
    'air defense system', 'radar system', 'cruise missile', 'attack helicopter'
  ],
  MEDIUM: [
    'armored vehicle', 'artillery', 'missile defense', 'surveillance drone',
    'transport aircraft', 'patrol vessel', 'communication system'
  ],
  LOW: [
    'small arms', 'ammunition', 'protective equipment', 'training equipment',
    'maintenance equipment', 'spare parts'
  ]
};

// Country risk profiles for strategic assessment
const COUNTRY_RISK_PROFILES = {
  HIGH_RISK: ['Iran', 'North Korea', 'Syria', 'Venezuela', 'Myanmar'],
  MEDIUM_RISK: ['China', 'Russia', 'Pakistan', 'Saudi Arabia', 'Turkey'],
  MONITORED: ['India', 'UAE', 'Egypt', 'Jordan', 'Thailand', 'Vietnam'],
  LOW_RISK: ['NATO countries', 'EU countries', 'Japan', 'South Korea', 'Australia']
};

// Main arms deal intelligence analysis function
export function analyzeArmsIntelligence(deal: ArmsAnalysisInput): ArmsIntelligenceResult {
  const timestamp = new Date().toISOString();
  
  // Validate input
  const validatedDeal = {
    ...deal,
    weapon_type: deal.weapon_type || 'Unknown',
    buyer_country: deal.buyer_country || 'Unknown',
    seller_country: deal.seller_country || undefined
  };
  
  // Strategic assessment
  const strategicAssessment = assessStrategicRisk(validatedDeal);
  
  // Geopolitical analysis
  const geopoliticalAnalysis = analyzeGeopoliticalImpact(validatedDeal);
  
  // Market intelligence
  const marketIntelligence = assessMarketSignificance(validatedDeal);
  
  // Monitoring priorities
  const monitoringPriorities = determineMonitoringRequirements(validatedDeal, strategicAssessment);
  
  // Calculate overall confidence
  const confidence = calculateAnalysisConfidence(validatedDeal);
  
  return {
    deal_id: validatedDeal.id,
    strategic_assessment: strategicAssessment,
    geopolitical_analysis: geopoliticalAnalysis,
    market_intelligence: marketIntelligence,
    monitoring_priorities: monitoringPriorities,
    confidence,
    processed_at: timestamp
  };
}

function assessStrategicRisk(deal: ArmsAnalysisInput): ArmsIntelligenceResult['strategic_assessment'] {
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  let proliferationRisk = 0.1; // Base risk
  let regionalImpact: 'stabilizing' | 'neutral' | 'destabilizing' | 'crisis_inducing' = 'neutral';
  let technologyLevel: 'basic' | 'advanced' | 'sensitive' | 'classified' = 'basic';
  
  const weaponType = (deal.weapon_type || '').toLowerCase();
  const buyerCountry = deal.buyer_country;
  
  // Assess weapon system criticality
  if (STRATEGIC_WEAPONS.CRITICAL.some(weapon => weaponType.includes(weapon))) {
    riskLevel = 'CRITICAL';
    proliferationRisk = 0.9;
    technologyLevel = 'classified';
    regionalImpact = 'crisis_inducing';
  } else if (STRATEGIC_WEAPONS.HIGH.some(weapon => weaponType.includes(weapon))) {
    riskLevel = 'HIGH';
    proliferationRisk = 0.7;
    technologyLevel = 'sensitive';
    regionalImpact = 'destabilizing';
  } else if (STRATEGIC_WEAPONS.MEDIUM.some(weapon => weaponType.includes(weapon))) {
    riskLevel = 'MEDIUM';
    proliferationRisk = 0.4;
    technologyLevel = 'advanced';
  } else {
    riskLevel = 'LOW';
    proliferationRisk = 0.2;
    technologyLevel = 'basic';
  }
  
  // Adjust based on buyer country risk profile
  if (COUNTRY_RISK_PROFILES.HIGH_RISK.includes(buyerCountry)) {
    if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
    else if (riskLevel === 'MEDIUM') riskLevel = 'HIGH';
    else if (riskLevel === 'HIGH') riskLevel = 'CRITICAL';
    proliferationRisk = Math.min(1.0, proliferationRisk + 0.3);
  }
  
  // Value-based risk adjustment
  if (deal.value_usd > 10000000000) { // $10B+
    proliferationRisk = Math.min(1.0, proliferationRisk + 0.2);
    if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
  }
  
  return {
    risk_level: riskLevel,
    proliferation_risk: Math.round(proliferationRisk * 10) / 10,
    regional_impact: regionalImpact,
    technology_transfer_level: technologyLevel
  };
}

function analyzeGeopoliticalImpact(deal: ArmsAnalysisInput): ArmsIntelligenceResult['geopolitical_analysis'] {
  const allianceImplications: string[] = [];
  let balanceOfPowerImpact = '';
  let conflictEscalationPotential = 1;
  let strategicSignificance = '';
  
  const buyerCountry = deal.buyer_country;
  const sellerCountry = deal.seller_country || 'Unknown';
  const weaponType = deal.weapon_type.toLowerCase();
  
  // Analyze regional tensions
  Object.entries(HIGH_TENSION_REGIONS).forEach(([region, countries]) => {
    if (countries.includes(buyerCountry)) {
      conflictEscalationPotential += 2;
      allianceImplications.push(`${region} regional balance affected`);
      
      // Check for rival countries in same region
      const rivals = countries.filter(country => country !== buyerCountry);
      if (rivals.length > 0) {
        balanceOfPowerImpact = `Enhances ${buyerCountry} capabilities relative to regional rivals: ${rivals.slice(0, 3).join(', ')}`;
      }
    }
  });
  
  // Strategic weapon implications
  if (STRATEGIC_WEAPONS.CRITICAL.some(weapon => weaponType.includes(weapon))) {
    conflictEscalationPotential += 4;
    strategicSignificance = 'Critical strategic capability enhancement with potential for regional arms race';
    allianceImplications.push('Nuclear/strategic balance implications');
  } else if (STRATEGIC_WEAPONS.HIGH.some(weapon => weaponType.includes(weapon))) {
    conflictEscalationPotential += 2;
    strategicSignificance = 'Significant military capability upgrade affecting regional power dynamics';
  } else {
    strategicSignificance = 'Routine military procurement with limited strategic impact';
  }
  
  // Alliance relationship analysis
  if (sellerCountry !== 'Unknown') {
    allianceImplications.push(`${sellerCountry}-${buyerCountry} defense relationship strengthened`);
    
    // NATO implications
    const natoCountries = ['United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Canada'];
    if (natoCountries.includes(sellerCountry)) {
      allianceImplications.push('NATO partner defense cooperation');
    }
  }
  
  // Cap escalation potential at 10
  conflictEscalationPotential = Math.min(10, conflictEscalationPotential);
  
  return {
    alliance_implications: allianceImplications,
    balance_of_power_impact: balanceOfPowerImpact || 'Limited regional impact',
    conflict_escalation_potential: conflictEscalationPotential,
    strategic_significance: strategicSignificance
  };
}

function assessMarketSignificance(deal: ArmsAnalysisInput): ArmsIntelligenceResult['market_intelligence'] {
  let dealClassification: 'routine' | 'significant' | 'major' | 'strategic' = 'routine';
  const marketTrends: string[] = [];
  let competitiveAnalysis = '';
  let pricingAssessment: 'below_market' | 'market_rate' | 'premium' | 'exceptional' = 'market_rate';
  
  const value = deal.value_usd;
  const weaponType = (deal.weapon_type || '').toLowerCase();
  const buyerCountry = deal.buyer_country;
  const sellerCountry = deal.seller_country || 'Unknown';
  
  // Deal classification by value
  if (value > 50000000000) { // $50B+
    dealClassification = 'strategic';
    marketTrends.push('Mega-deal indicating long-term strategic partnership');
    pricingAssessment = 'exceptional';
  } else if (value > 10000000000) { // $10B+
    dealClassification = 'major';
    marketTrends.push('Major procurement program with multi-year delivery');
    pricingAssessment = 'premium';
  } else if (value > 1000000000) { // $1B+
    dealClassification = 'significant';
    marketTrends.push('Significant capability enhancement program');
  }
  
  // Weapon system market trends
  if (weaponType.includes('fighter') || weaponType.includes('aircraft')) {
    marketTrends.push('Air superiority modernization trend');
  } else if (weaponType.includes('missile') || weaponType.includes('defense')) {
    marketTrends.push('Defensive capability investment trend');
  } else if (weaponType.includes('naval') || weaponType.includes('ship')) {
    marketTrends.push('Naval force projection enhancement');
  }
  
  // Regional market analysis
  marketTrends.push(`${buyerCountry} defense modernization initiative`);
  
  // Competitive analysis
  if (sellerCountry !== 'Unknown') {
    competitiveAnalysis = `${sellerCountry} strengthens position in ${weaponType} market segment. `;
    competitiveAnalysis += `Competition implications for alternative suppliers in ${buyerCountry} market.`;
  } else {
    competitiveAnalysis = `Market activity in ${weaponType} segment with undisclosed supplier competition.`;
  }
  
  return {
    deal_classification: dealClassification,
    market_trends: marketTrends,
    competitive_analysis: competitiveAnalysis,
    pricing_assessment: pricingAssessment
  };
}

function determineMonitoringRequirements(
  deal: ArmsAnalysisInput, 
  strategic: ArmsIntelligenceResult['strategic_assessment']
): ArmsIntelligenceResult['monitoring_priorities'] {
  
  const keyIndicators: string[] = [];
  const followUpActions: string[] = [];
  const reportingRequirements: string[] = [];
  let oversightLevel: 'routine' | 'enhanced' | 'intensive' | 'critical' = 'routine';
  
  // Determine oversight level based on risk
  if (strategic.risk_level === 'CRITICAL') {
    oversightLevel = 'critical';
    keyIndicators.push('Technology transfer verification', 'End-use monitoring', 'Third-party transfer prevention');
    followUpActions.push('Continuous monitoring required', 'Regular compliance audits', 'Intelligence community coordination');
    reportingRequirements.push('Weekly status reports', 'Congressional notification', 'Allied intelligence sharing');
  } else if (strategic.risk_level === 'HIGH') {
    oversightLevel = 'intensive';
    keyIndicators.push('Delivery timeline tracking', 'Capability integration monitoring', 'Regional response assessment');
    followUpActions.push('Regular verification checks', 'Regional impact assessment', 'Policy review consideration');
    reportingRequirements.push('Monthly progress reports', 'Quarterly strategic assessment');
  } else if (strategic.risk_level === 'MEDIUM') {
    oversightLevel = 'enhanced';
    keyIndicators.push('Delivery confirmation', 'Regional stability monitoring');
    followUpActions.push('Periodic status updates', 'Regional monitoring');
    reportingRequirements.push('Quarterly summary reports');
  } else {
    oversightLevel = 'routine';
    keyIndicators.push('Transaction completion');
    followUpActions.push('Standard monitoring procedures');
    reportingRequirements.push('Annual review inclusion');
  }
  
  // Additional indicators based on weapon type
  const weaponType = deal.weapon_type.toLowerCase();
  if (STRATEGIC_WEAPONS.CRITICAL.some(weapon => weaponType.includes(weapon))) {
    keyIndicators.push('Nuclear security protocols', 'Strategic stability implications');
  } else if (weaponType.includes('cyber') || weaponType.includes('electronic')) {
    keyIndicators.push('Dual-use technology controls', 'Information security measures');
  }
  
  return {
    oversight_level: oversightLevel,
    key_indicators: keyIndicators,
    follow_up_actions: followUpActions,
    reporting_requirements: reportingRequirements
  };
}

function calculateAnalysisConfidence(deal: ArmsAnalysisInput): number {
  let confidence = 0.7; // Base confidence
  
  // Boost confidence for complete data
  if (deal.seller_country) confidence += 0.1;
  if (deal.description) confidence += 0.1;
  if (deal.sources && deal.sources.length > 0) confidence += 0.1;
  if (deal.contract_date) confidence += 0.05;
  if (deal.delivery_date) confidence += 0.05;
  
  // Reduce confidence for missing critical data
  if (!deal.value_usd || deal.value_usd <= 0) confidence -= 0.2;
  if (!deal.weapon_type || deal.weapon_type.trim() === '') confidence -= 0.3;
  
  return Math.max(0.3, Math.min(1.0, Math.round(confidence * 100) / 100));
}

// Batch processing for multiple arms deals
export function batchAnalyzeArmsIntelligence(deals: ArmsAnalysisInput[]): ArmsIntelligenceResult[] {
  return deals.map(deal => analyzeArmsIntelligence(deal));
}

// Strategic overview for portfolio of deals
export function generateStrategicOverview(deals: ArmsAnalysisInput[]): {
  summary: {
    total_deals: number;
    total_value: number;
    risk_distribution: Record<string, number>;
    top_buyers: string[];
    top_sellers: string[];
  };
  trends: {
    weapon_categories: Record<string, number>;
    regional_activity: Record<string, number>;
    escalation_indicators: string[];
  };
  recommendations: string[];
} {
  const analyses = batchAnalyzeArmsIntelligence(deals);
  
  // Calculate summary statistics
  const totalValue = deals.reduce((sum, deal) => sum + deal.value_usd, 0);
  const riskDistribution = analyses.reduce((acc, analysis) => {
    acc[analysis.strategic_assessment.risk_level] = (acc[analysis.strategic_assessment.risk_level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Top buyers and sellers
  const buyerCounts = deals.reduce((acc, deal) => {
    acc[deal.buyer_country] = (acc[deal.buyer_country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sellerCounts = deals.reduce((acc, deal) => {
    if (deal.seller_country) {
      acc[deal.seller_country] = (acc[deal.seller_country] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const topBuyers = Object.entries(buyerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([country]) => country);
  
  const topSellers = Object.entries(sellerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([country]) => country);
  
  // Analyze trends
  const weaponCategories = deals.reduce((acc, deal) => {
    const category = categorizeWeapon(deal.weapon_type);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const regionalActivity = deals.reduce((acc, deal) => {
    const region = getCountryRegion(deal.buyer_country);
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Generate escalation indicators
  const escalationIndicators: string[] = [];
  const criticalDeals = analyses.filter(a => a.strategic_assessment.risk_level === 'CRITICAL').length;
  const highRiskDeals = analyses.filter(a => a.strategic_assessment.risk_level === 'HIGH').length;
  
  if (criticalDeals > 0) {
    escalationIndicators.push(`${criticalDeals} critical risk deals requiring immediate attention`);
  }
  if (highRiskDeals > 3) {
    escalationIndicators.push(`High volume of high-risk deals (${highRiskDeals}) indicating potential arms race`);
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (criticalDeals > 0) {
    recommendations.push('Immediate review of critical risk deals for enhanced monitoring');
  }
  if (totalValue > 100000000000) { // $100B+
    recommendations.push('Portfolio value exceeds $100B - strategic oversight recommended');
  }
  
  return {
    summary: {
      total_deals: deals.length,
      total_value: totalValue,
      risk_distribution: riskDistribution,
      top_buyers: topBuyers,
      top_sellers: topSellers
    },
    trends: {
      weapon_categories: weaponCategories,
      regional_activity: regionalActivity,
      escalation_indicators: escalationIndicators
    },
    recommendations: recommendations
  };
}

// Helper functions
function categorizeWeapon(weaponType: string): string {
  const type = weaponType.toLowerCase();
  if (type.includes('aircraft') || type.includes('fighter') || type.includes('bomber')) return 'Aircraft';
  if (type.includes('missile') || type.includes('rocket')) return 'Missiles';
  if (type.includes('ship') || type.includes('naval') || type.includes('submarine')) return 'Naval';
  if (type.includes('tank') || type.includes('armored')) return 'Land Systems';
  if (type.includes('radar') || type.includes('electronic') || type.includes('cyber')) return 'Electronics';
  if (type.includes('small arms') || type.includes('ammunition')) return 'Small Arms';
  return 'Other';
}

function getCountryRegion(country: string): string {
  for (const [region, countries] of Object.entries(HIGH_TENSION_REGIONS)) {
    if (countries.includes(country)) return region;
  }
  return 'Other';
}

const armsIntelligence = {
  analyzeArmsIntelligence,
  batchAnalyzeArmsIntelligence,
  generateStrategicOverview
};

export default armsIntelligence;