/**
 * Fact Validator Service
 * Validates facts through cross-source comparison
 */

export class FactValidator {
  constructor() {
    // Fact types that can be validated
    this.validatableTypes = [
      'casualty',
      'location',
      'date',
      'participant',
      'weapon',
      'quantity'
    ];
    
    // Threshold for considering facts as matching
    this.similarityThreshold = 0.8;
  }
  
  /**
   * Validate facts through cross-source comparison
   */
  async validateFacts(facts) {
    const factGroups = this.groupSimilarFacts(facts);
    
    const validated = {
      corroborated: [],
      disputed: [],
      unverified: []
    };
    
    for (const group of factGroups) {
      if (group.facts.length === 1) {
        // Single source - unverified
        validated.unverified.push({
          ...group.facts[0],
          status: 'unverified',
          sources: 1
        });
      } else {
        // Multiple sources - check for consistency
        const consistency = this.checkFactConsistency(group.facts);
        
        if (consistency.isConsistent) {
          validated.corroborated.push({
            claim: consistency.consensusClaim,
            type: group.type,
            confidence: consistency.confidence,
            status: 'corroborated',
            sources: group.facts.length,
            sourceArticles: group.facts.map(f => f.sourceArticle)
          });
        } else {
          validated.disputed.push({
            claim: group.facts[0].claim,
            type: group.type,
            variations: consistency.variations,
            status: 'disputed',
            sources: group.facts.length,
            sourceArticles: group.facts.map(f => f.sourceArticle)
          });
        }
      }
    }
    
    return validated;
  }
  
  /**
   * Group similar facts together
   */
  groupSimilarFacts(facts) {
    const groups = [];
    const assigned = new Set();
    
    for (let i = 0; i < facts.length; i++) {
      if (assigned.has(i)) continue;
      
      const group = {
        type: facts[i].type,
        facts: [facts[i]]
      };
      assigned.add(i);
      
      // Find similar facts
      for (let j = i + 1; j < facts.length; j++) {
        if (assigned.has(j)) continue;
        
        if (this.areFactsSimilar(facts[i], facts[j])) {
          group.facts.push(facts[j]);
          assigned.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }
  
  /**
   * Check if two facts are similar enough to group
   */
  areFactsSimilar(fact1, fact2) {
    // Must be same type
    if (fact1.type !== fact2.type) return false;
    
    switch (fact1.type) {
      case 'casualty':
        return this.areCasualtiesSimilar(fact1, fact2);
      
      case 'location':
        return this.areLocationsSimilar(fact1, fact2);
      
      case 'date':
        return this.areDatesSimilar(fact1, fact2);
      
      case 'participant':
        return this.areParticipantsSimilar(fact1, fact2);
      
      default:
        return this.areClaimsSimilar(fact1.claim, fact2.claim);
    }
  }
  
  /**
   * Check if casualty facts are similar
   */
  areCasualtiesSimilar(fact1, fact2) {
    // Check if discussing same type of casualties
    const type1 = this.extractCasualtyType(fact1.claim);
    const type2 = this.extractCasualtyType(fact2.claim);
    
    if (type1 !== type2) return false;
    
    // Check if numbers are within reasonable range
    const num1 = fact1.value || this.extractNumber(fact1.claim);
    const num2 = fact2.value || this.extractNumber(fact2.claim);
    
    if (num1 && num2) {
      const ratio = Math.min(num1, num2) / Math.max(num1, num2);
      return ratio > 0.5; // Within 2x range
    }
    
    return true;
  }
  
  /**
   * Extract casualty type from claim
   */
  extractCasualtyType(claim) {
    if (/kill|dead|death/i.test(claim)) return 'killed';
    if (/wound|injur|hurt/i.test(claim)) return 'wounded';
    if (/missing|disappear/i.test(claim)) return 'missing';
    return 'unknown';
  }
  
  /**
   * Extract number from claim
   */
  extractNumber(claim) {
    const match = claim.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }
  
  /**
   * Check consistency among grouped facts
   */
  checkFactConsistency(facts) {
    if (facts[0].type === 'casualty') {
      return this.checkCasualtyConsistency(facts);
    }
    
    // For other types, check if majority agree
    const claimCounts = {};
    facts.forEach(fact => {
      const normalizedClaim = this.normalizeClaim(fact.claim);
      claimCounts[normalizedClaim] = (claimCounts[normalizedClaim] || 0) + 1;
    });
    
    const totalSources = facts.length;
    const mostCommon = Object.entries(claimCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    const agreementRate = mostCommon[1] / totalSources;
    
    return {
      isConsistent: agreementRate > 0.6,
      consensusClaim: mostCommon[0],
      confidence: agreementRate,
      variations: Object.keys(claimCounts)
    };
  }
  
  /**
   * Check consistency for casualty figures
   */
  checkCasualtyConsistency(facts) {
    const numbers = facts
      .map(f => f.value || this.extractNumber(f.claim))
      .filter(n => n !== null);
    
    if (numbers.length === 0) {
      return {
        isConsistent: false,
        confidence: 0,
        variations: facts.map(f => f.claim)
      };
    }
    
    // Calculate statistics
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const stdDev = Math.sqrt(
      numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length
    );
    
    // Check if numbers are reasonably close
    const coefficientOfVariation = stdDev / mean;
    const isConsistent = coefficientOfVariation < 0.3; // Within 30% variation
    
    // Find median as consensus
    const sorted = [...numbers].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    return {
      isConsistent: isConsistent,
      consensusClaim: `${median} ${this.extractCasualtyType(facts[0].claim)}`,
      confidence: isConsistent ? (1 - coefficientOfVariation) : 0.3,
      variations: numbers.map(n => `${n} casualties`),
      statistics: {
        mean: mean,
        median: median,
        stdDev: stdDev,
        min: Math.min(...numbers),
        max: Math.max(...numbers)
      }
    };
  }
  
  /**
   * Normalize claim for comparison
   */
  normalizeClaim(claim) {
    return claim
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }
  
  /**
   * Check if locations are similar
   */
  areLocationsSimilar(fact1, fact2) {
    const loc1 = fact1.claim.toLowerCase();
    const loc2 = fact2.claim.toLowerCase();
    
    // Exact match
    if (loc1 === loc2) return true;
    
    // One contains the other
    if (loc1.includes(loc2) || loc2.includes(loc1)) return true;
    
    // Common location aliases
    const aliases = {
      'gaza strip': ['gaza', 'gaza city'],
      'west bank': ['westbank', 'judea and samaria'],
      'damascus': ['dimashq'],
      'kyiv': ['kiev'],
    };
    
    for (const [main, alts] of Object.entries(aliases)) {
      if ((loc1.includes(main) || alts.some(alt => loc1.includes(alt))) &&
          (loc2.includes(main) || alts.some(alt => loc2.includes(alt)))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if dates are similar
   */
  areDatesSimilar(fact1, fact2) {
    // Extract dates from claims
    const date1 = new Date(fact1.value || fact1.claim);
    const date2 = new Date(fact2.value || fact2.claim);
    
    if (isNaN(date1) || isNaN(date2)) return false;
    
    // Check if within 24 hours
    const diffHours = Math.abs(date1 - date2) / (1000 * 60 * 60);
    return diffHours < 24;
  }
  
  /**
   * Check if participants are similar
   */
  areParticipantsSimilar(fact1, fact2) {
    const p1 = this.normalizeClaim(fact1.claim);
    const p2 = this.normalizeClaim(fact2.claim);
    
    // Check for common aliases
    const participantAliases = {
      'idf': ['israeli defense forces', 'israeli military', 'israeli forces'],
      'hamas': ['hamas militants', 'hamas fighters'],
      'russia': ['russian forces', 'russian military'],
      'ukraine': ['ukrainian forces', 'ukrainian military', 'afu']
    };
    
    for (const [main, aliases] of Object.entries(participantAliases)) {
      const allTerms = [main, ...aliases];
      const p1Matches = allTerms.some(term => p1.includes(term));
      const p2Matches = allTerms.some(term => p2.includes(term));
      
      if (p1Matches && p2Matches) return true;
    }
    
    return p1 === p2;
  }
  
  /**
   * Generic claim similarity check
   */
  areClaimsSimilar(claim1, claim2) {
    const normalized1 = this.normalizeClaim(claim1);
    const normalized2 = this.normalizeClaim(claim2);
    
    // Exact match after normalization
    if (normalized1 === normalized2) return true;
    
    // Calculate word overlap
    const words1 = new Set(normalized1.split(' '));
    const words2 = new Set(normalized2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    return jaccardSimilarity > this.similarityThreshold;
  }
  
  /**
   * Calculate overall fact reliability score
   */
  calculateFactReliability(validatedFacts) {
    const total = validatedFacts.corroborated.length + 
                  validatedFacts.disputed.length + 
                  validatedFacts.unverified.length;
    
    if (total === 0) return 0;
    
    const weights = {
      corroborated: 1.0,
      disputed: 0.3,
      unverified: 0.5
    };
    
    const score = (
      validatedFacts.corroborated.length * weights.corroborated +
      validatedFacts.disputed.length * weights.disputed +
      validatedFacts.unverified.length * weights.unverified
    ) / total;
    
    return score;
  }
}