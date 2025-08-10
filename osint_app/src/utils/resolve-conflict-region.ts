/**
 * Conflict Region Resolution Utility
 * Maps countries to regions and provides coordinate estimation for new conflicts
 */

export interface CountryRegionMapping {
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  aliases: string[];
}

// Comprehensive country-to-region mapping with coordinates
const COUNTRY_REGION_MAP: CountryRegionMapping[] = [
  // Middle East
  { country: 'Israel', region: 'Middle East', latitude: 31.0461, longitude: 34.8516, aliases: ['israeli', 'israel'] },
  { country: 'Palestine', region: 'Middle East', latitude: 31.9522, longitude: 35.2332, aliases: ['palestinian', 'gaza', 'west bank', 'palestine'] },
  { country: 'Iran', region: 'Middle East', latitude: 32.4279, longitude: 53.6880, aliases: ['iranian', 'persia'] },
  { country: 'Iraq', region: 'Middle East', latitude: 33.2232, longitude: 43.6793, aliases: ['iraqi'] },
  { country: 'Syria', region: 'Middle East', latitude: 34.8021, longitude: 38.9968, aliases: ['syrian'] },
  { country: 'Lebanon', region: 'Middle East', latitude: 33.8547, longitude: 35.8623, aliases: ['lebanese'] },
  { country: 'Jordan', region: 'Middle East', latitude: 30.5852, longitude: 36.2384, aliases: ['jordanian'] },
  { country: 'Saudi Arabia', region: 'Middle East', latitude: 23.8859, longitude: 45.0792, aliases: ['saudi', 'saudis'] },
  { country: 'Yemen', region: 'Middle East', latitude: 15.5527, longitude: 48.5164, aliases: ['yemeni', 'houthi', 'houthis'] },
  
  // Europe
  { country: 'Ukraine', region: 'Europe', latitude: 48.3794, longitude: 31.1656, aliases: ['ukrainian', 'kyiv', 'kiev', 'kharkiv', 'mariupol'] },
  { country: 'Russia', region: 'Europe', latitude: 61.5240, longitude: 105.3188, aliases: ['russian', 'moscow', 'kremlin', 'putin'] },
  { country: 'Belarus', region: 'Europe', latitude: 53.7098, longitude: 27.9534, aliases: ['belarusian'] },
  { country: 'Poland', region: 'Europe', latitude: 51.9194, longitude: 19.1451, aliases: ['polish'] },
  { country: 'Moldova', region: 'Europe', latitude: 47.4116, longitude: 28.3699, aliases: ['moldovan'] },
  
  // Africa
  { country: 'Sudan', region: 'Africa', latitude: 12.8628, longitude: 30.2176, aliases: ['sudanese', 'khartoum', 'darfur'] },
  { country: 'South Sudan', region: 'Africa', latitude: 6.8770, longitude: 31.3070, aliases: ['south sudanese'] },
  { country: 'Ethiopia', region: 'Africa', latitude: 9.1450, longitude: 40.4897, aliases: ['ethiopian', 'tigray'] },
  { country: 'Somalia', region: 'Africa', latitude: 5.1521, longitude: 46.1996, aliases: ['somali', 'mogadishu'] },
  { country: 'Democratic Republic of Congo', region: 'Africa', latitude: -4.0383, longitude: 21.7587, aliases: ['drc', 'congo', 'congolese'] },
  { country: 'Mali', region: 'Africa', latitude: 17.5707, longitude: -3.9962, aliases: ['malian'] },
  { country: 'Burkina Faso', region: 'Africa', latitude: 12.2383, longitude: -1.5616, aliases: ['burkinabe'] },
  { country: 'Niger', region: 'Africa', latitude: 17.6078, longitude: 8.0817, aliases: ['nigerien'] },
  { country: 'Chad', region: 'Africa', latitude: 15.4542, longitude: 18.7322, aliases: ['chadian'] },
  { country: 'Libya', region: 'Africa', latitude: 26.3351, longitude: 17.2283, aliases: ['libyan', 'tripoli', 'benghazi'] },
  
  // Asia
  { country: 'Myanmar', region: 'Asia', latitude: 21.9162, longitude: 95.9560, aliases: ['burma', 'burmese', 'myanmar'] },
  { country: 'Afghanistan', region: 'Asia', latitude: 33.9391, longitude: 67.7100, aliases: ['afghan', 'kabul', 'taliban'] },
  { country: 'Pakistan', region: 'Asia', latitude: 30.3753, longitude: 69.3451, aliases: ['pakistani'] },
  { country: 'India', region: 'Asia', latitude: 20.5937, longitude: 78.9629, aliases: ['indian', 'kashmir'] },
  { country: 'China', region: 'Asia', latitude: 35.8617, longitude: 104.1954, aliases: ['chinese', 'beijing', 'xinjiang', 'tibet'] },
  { country: 'North Korea', region: 'Asia', latitude: 40.3399, longitude: 127.5101, aliases: ['dprk', 'pyongyang'] },
  { country: 'South Korea', region: 'Asia', latitude: 35.9078, longitude: 127.7669, aliases: ['korean', 'seoul'] },
  { country: 'Taiwan', region: 'Asia', latitude: 23.6978, longitude: 120.9605, aliases: ['taiwanese'] },
  
  // Americas
  { country: 'Colombia', region: 'Americas', latitude: 4.5709, longitude: -74.2973, aliases: ['colombian'] },
  { country: 'Venezuela', region: 'Americas', latitude: 6.4238, longitude: -66.5897, aliases: ['venezuelan'] },
  { country: 'Mexico', region: 'Americas', latitude: 23.6345, longitude: -102.5528, aliases: ['mexican'] },
  { country: 'Haiti', region: 'Americas', latitude: 18.9712, longitude: -72.2852, aliases: ['haitian'] },
  
  // Oceania
  { country: 'Papua New Guinea', region: 'Oceania', latitude: -6.3150, longitude: 143.9555, aliases: ['png'] }
];

// Common conflict-related keywords that indicate military/security events
const CONFLICT_KEYWORDS = [
  'war', 'conflict', 'fighting', 'battle', 'combat', 'military', 'army', 'forces',
  'attack', 'strike', 'bombing', 'explosion', 'missile', 'rocket', 'shell',
  'casualties', 'killed', 'wounded', 'injured', 'dead', 'deaths',
  'invasion', 'occupation', 'siege', 'ceasefire', 'truce', 'peace',
  'rebel', 'insurgent', 'terrorist', 'militia', 'paramilitary',
  'violence', 'clashes', 'unrest', 'uprising', 'protest', 'riot',
  'security', 'threat', 'alert', 'crisis', 'emergency'
];

export interface ConflictDetectionResult {
  isConflictRelated: boolean;
  confidence: number;
  country?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  detectedKeywords: string[];
  conflictType: string;
}

/**
 * Analyzes text to detect if it's conflict-related and extract location
 */
export function detectConflictFromText(
  headline: string, 
  summary?: string, 
  tags: string[] = []
): ConflictDetectionResult {
  const fullText = `${headline || ''} ${summary || ''} ${tags.join(' ')}`.toLowerCase();
  
  // Check for conflict keywords
  const detectedKeywords = CONFLICT_KEYWORDS.filter(keyword => 
    fullText.includes(keyword)
  );
  
  // Calculate confidence based on keyword matches and escalation indicators
  let confidence = Math.min(detectedKeywords.length * 0.15, 1.0);
  
  // Boost confidence for specific high-impact keywords
  const highImpactKeywords = ['war', 'invasion', 'bombing', 'missile', 'killed', 'attack'];
  const highImpactMatches = highImpactKeywords.filter(keyword => fullText.includes(keyword));
  confidence += highImpactMatches.length * 0.1;
  
  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);
  
  // Find country/region matches
  let bestMatch: CountryRegionMapping | undefined;
  let matchScore = 0;
  
  for (const mapping of COUNTRY_REGION_MAP) {
    // Check exact country name match
    if (fullText.includes(mapping.country.toLowerCase())) {
      const score = fullText.length > 0 ? mapping.country.length / fullText.length : 0;
      if (score > matchScore) {
        bestMatch = mapping;
        matchScore = score;
      }
    }
    
    // Check aliases
    for (const alias of mapping.aliases) {
      if (fullText.includes(alias.toLowerCase())) {
        const score = fullText.length > 0 ? alias.length / fullText.length : 0;
        if (score > matchScore) {
          bestMatch = mapping;
          matchScore = score;
        }
      }
    }
  }
  
  // Determine conflict type based on keywords
  let conflictType = 'other';
  if (fullText.includes('civil war') || fullText.includes('civil conflict')) {
    conflictType = 'civil_war';
  } else if (fullText.includes('border') || fullText.includes('territorial')) {
    conflictType = 'territorial_dispute';
  } else if (fullText.includes('insurgent') || fullText.includes('rebel')) {
    conflictType = 'insurgency';
  } else if (fullText.includes('occupation') || fullText.includes('invasion')) {
    conflictType = 'occupation';
  }
  
  return {
    isConflictRelated: confidence >= 0.3 && detectedKeywords.length >= 2,
    confidence,
    country: bestMatch?.country,
    region: bestMatch?.region,
    latitude: bestMatch?.latitude,
    longitude: bestMatch?.longitude,
    detectedKeywords,
    conflictType
  };
}

/**
 * Generates a unique hash for conflict deduplication
 */
export function generateConflictHash(country: string, region: string, conflictType: string): string {
  const baseString = `${country}-${region}-${conflictType}`.toLowerCase().replace(/\s+/g, '-');
  return Buffer.from(baseString).toString('base64').substring(0, 12);
}

/**
 * Resolves a country name to its region and coordinates
 */
export function resolveCountryToRegion(countryName: string): CountryRegionMapping | null {
  const normalizedName = countryName.toLowerCase();
  
  // Find exact match first
  let match = COUNTRY_REGION_MAP.find(mapping => 
    mapping.country.toLowerCase() === normalizedName
  );
  
  // If no exact match, try aliases
  if (!match) {
    match = COUNTRY_REGION_MAP.find(mapping =>
      mapping.aliases.some(alias => alias.toLowerCase() === normalizedName)
    );
  }
  
  // If still no match, try partial matching
  if (!match) {
    match = COUNTRY_REGION_MAP.find(mapping =>
      mapping.country.toLowerCase().includes(normalizedName) ||
      mapping.aliases.some(alias => alias.toLowerCase().includes(normalizedName))
    );
  }
  
  return match || null;
}

/**
 * Estimates conflict severity based on keywords and context
 */
export function estimateConflictSeverity(
  headline: string, 
  summary?: string, 
  escalationScore?: number
): number {
  if (escalationScore && escalationScore >= 1) {
    return escalationScore;
  }
  
  const fullText = `${headline} ${summary || ''}`.toLowerCase();
  
  // High severity indicators
  const highSeverityKeywords = [
    'war', 'invasion', 'bombing', 'massacre', 'genocide', 'killed', 'dead', 'deaths',
    'missile strike', 'air strike', 'artillery', 'casualties', 'wounded'
  ];
  
  // Medium severity indicators  
  const mediumSeverityKeywords = [
    'attack', 'fighting', 'battle', 'clash', 'violence', 'conflict',
    'military operation', 'offensive', 'siege'
  ];
  
  // Low severity indicators
  const lowSeverityKeywords = [
    'tension', 'dispute', 'protest', 'unrest', 'alert', 'threat',
    'ceasefire', 'negotiation', 'peace talks'
  ];
  
  const highMatches = highSeverityKeywords.filter(keyword => fullText.includes(keyword)).length;
  const mediumMatches = mediumSeverityKeywords.filter(keyword => fullText.includes(keyword)).length;
  const lowMatches = lowSeverityKeywords.filter(keyword => fullText.includes(keyword)).length;
  
  // Calculate weighted score
  let severity = (highMatches * 3) + (mediumMatches * 2) + (lowMatches * 1);
  
  // Normalize to 1-10 scale
  if (severity >= 6) return Math.min(9, severity);
  if (severity >= 4) return Math.min(7, severity + 1);
  if (severity >= 2) return Math.min(5, severity + 1);
  if (severity >= 1) return 3;
  return 2;
}

const conflictRegionUtils = {
  detectConflictFromText,
  generateConflictHash,
  resolveCountryToRegion,
  estimateConflictSeverity,
  COUNTRY_REGION_MAP,
  CONFLICT_KEYWORDS
};

export default conflictRegionUtils;